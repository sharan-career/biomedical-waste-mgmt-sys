import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { recomputeInvoiceBalance } from '../billing/invoice-balance.util';
import { ApplyCreditDto } from './dto/apply-credit.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';

const PAYMENT_INCLUDE = {
  customer: {
    select: { id: true, customerCode: true, organizationName: true },
  },
  allocations: {
    include: { invoice: { select: { id: true, invoiceNumber: true } } },
  },
} as const;

// Invoices must have already been sent before they can receive a payment — this keeps the
// "what status reverts to when a reversal drops paidAmount back to 0" question unambiguous.
const PAYABLE_INVOICE_STATUSES: InvoiceStatus[] = ['SENT', 'PARTIALLY_PAID'];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async record(dto: CreatePaymentDto, actorUserId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const allocations = dto.allocations ?? [];
    const requestedTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (requestedTotal > dto.amount) {
      throw new BadRequestException(
        'Allocations cannot exceed the payment amount',
      );
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: allocations.map((a) => a.invoiceId) } },
    });
    for (const allocation of allocations) {
      const invoice = invoices.find((i) => i.id === allocation.invoiceId);
      if (!invoice || invoice.customerId !== dto.customerId) {
        throw new NotFoundException(
          `Invoice ${allocation.invoiceId} not found for this customer`,
        );
      }
      if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
        throw new BadRequestException(
          `Invoice ${invoice.invoiceNumber} is not in a payable state (${invoice.status})`,
        );
      }
      if (
        new Decimal(allocation.amount).greaterThan(
          invoice.outstandingAmount.toString(),
        )
      ) {
        throw new BadRequestException(
          `Allocation of ${allocation.amount} exceeds invoice ${invoice.invoiceNumber}'s outstanding balance of ${invoice.outstandingAmount}`,
        );
      }
    }

    const unallocatedRemainder = new Decimal(dto.amount).minus(requestedTotal);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          customerId: dto.customerId,
          amount: dto.amount,
          paymentMode: dto.paymentMode,
          paymentDate: new Date(dto.paymentDate),
          referenceNumber: dto.referenceNumber,
          bankDetails: dto.bankDetails,
          notes: dto.notes,
          createdBy: actorUserId,
          updatedBy: actorUserId,
          allocations: {
            create: [
              ...allocations.map((a) => ({
                invoiceId: a.invoiceId,
                allocatedAmount: a.amount,
              })),
              ...(unallocatedRemainder.greaterThan(0)
                ? [{ invoiceId: null, allocatedAmount: unallocatedRemainder }]
                : []),
            ],
          },
        },
        include: PAYMENT_INCLUDE,
      });

      for (const allocation of allocations) {
        await recomputeInvoiceBalance(tx, allocation.invoiceId);
      }

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'PAYMENT_RECORDED',
        entityType: 'Payment',
        entityId: payment.id,
        newValue: { customerId: dto.customerId, amount: dto.amount },
      });

      return payment;
    });
  }

  async findAll(query: PaymentQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.PaymentWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: PAYMENT_INCLUDE,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  async findOneOrThrow(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: PAYMENT_INCLUDE,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async reverse(id: string, dto: ReversePaymentDto, actorUserId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === 'REVERSED') {
      throw new BadRequestException('Payment is already reversed');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: { status: 'REVERSED', updatedBy: actorUserId },
      });

      const reversal = await tx.payment.create({
        data: {
          customerId: payment.customerId,
          amount: payment.amount,
          paymentMode: payment.paymentMode,
          paymentDate: new Date(),
          notes: `Reversal: ${dto.reason}`,
          reversalOfPaymentId: payment.id,
          createdBy: actorUserId,
          updatedBy: actorUserId,
          allocations: {
            create: payment.allocations.map((a) => ({
              invoiceId: a.invoiceId,
              allocatedAmount: new Decimal(
                a.allocatedAmount.toString(),
              ).negated(),
            })),
          },
        },
        include: PAYMENT_INCLUDE,
      });

      const affectedInvoiceIds = [
        ...new Set(
          payment.allocations
            .map((a) => a.invoiceId)
            .filter((id): id is string => id !== null),
        ),
      ];
      for (const invoiceId of affectedInvoiceIds) {
        await recomputeInvoiceBalance(tx, invoiceId);
      }

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'PAYMENT_REVERSED',
        entityType: 'Payment',
        entityId: payment.id,
        previousValue: { status: 'RECORDED' },
        newValue: {
          status: 'REVERSED',
          reason: dto.reason,
          reversalPaymentId: reversal.id,
        },
      });

      return reversal;
    });
  }

  async getCreditBalance(
    customerId: string,
  ): Promise<{ customerId: string; availableCredit: string }> {
    const result = await this.prisma.paymentAllocation.aggregate({
      where: { invoiceId: null, payment: { customerId } },
      _sum: { allocatedAmount: true },
    });
    return {
      customerId,
      availableCredit: (
        result._sum.allocatedAmount ?? new Decimal(0)
      ).toString(),
    };
  }

  async applyCredit(
    customerId: string,
    dto: ApplyCreditDto,
    actorUserId: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, customerId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found for this customer');
    }
    if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new BadRequestException(
        `Invoice is not in a payable state (${invoice.status})`,
      );
    }
    if (
      new Decimal(dto.amount).greaterThan(invoice.outstandingAmount.toString())
    ) {
      throw new BadRequestException(
        'Amount exceeds the invoice outstanding balance',
      );
    }

    // Draw down credit FIFO across whichever payments still have unallocated balance.
    const creditRows = await this.prisma.paymentAllocation.groupBy({
      by: ['paymentId'],
      where: { invoiceId: null, payment: { customerId } },
      _sum: { allocatedAmount: true },
    });
    const paymentsWithCredit = await this.prisma.payment.findMany({
      where: { id: { in: creditRows.map((r) => r.paymentId) } },
      orderBy: { createdAt: 'asc' },
    });

    let remaining = new Decimal(dto.amount);
    const draws: { paymentId: string; amount: Decimal }[] = [];
    for (const payment of paymentsWithCredit) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const row = creditRows.find((r) => r.paymentId === payment.id);
      const available = new Decimal(
        (row?._sum.allocatedAmount ?? new Decimal(0)).toString(),
      );
      if (available.lessThanOrEqualTo(0)) continue;
      const draw = Decimal.min(available, remaining);
      draws.push({ paymentId: payment.id, amount: draw });
      remaining = remaining.minus(draw);
    }
    if (remaining.greaterThan(0)) {
      throw new BadRequestException(
        'Customer does not have enough available credit balance',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const draw of draws) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: draw.paymentId,
            invoiceId: dto.invoiceId,
            allocatedAmount: draw.amount,
          },
        });
        await tx.paymentAllocation.create({
          data: {
            paymentId: draw.paymentId,
            invoiceId: null,
            allocatedAmount: draw.amount.negated(),
          },
        });
      }

      const updatedInvoice = await recomputeInvoiceBalance(tx, dto.invoiceId);

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CREDIT_APPLIED',
        entityType: 'Invoice',
        entityId: dto.invoiceId,
        newValue: { amount: dto.amount },
      });

      return updatedInvoice;
    });
  }

  async getAgingReport(customerId?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: PAYABLE_INVOICE_STATUSES },
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: {
          select: { id: true, customerCode: true, organizationName: true },
        },
      },
    });

    const buckets = {
      current: new Decimal(0),
      days1To30: new Decimal(0),
      days31To60: new Decimal(0),
      days61To90: new Decimal(0),
      days90Plus: new Decimal(0),
    };
    const today = new Date();
    const items = invoices.map((invoice) => {
      const daysPastDue = Math.floor(
        (today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const outstanding = new Decimal(invoice.outstandingAmount.toString());
      let bucket: keyof typeof buckets;
      if (daysPastDue <= 0) bucket = 'current';
      else if (daysPastDue <= 30) bucket = 'days1To30';
      else if (daysPastDue <= 60) bucket = 'days31To60';
      else if (daysPastDue <= 90) bucket = 'days61To90';
      else bucket = 'days90Plus';
      buckets[bucket] = buckets[bucket].plus(outstanding);

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customer: invoice.customer,
        dueDate: invoice.dueDate,
        outstandingAmount: invoice.outstandingAmount,
        daysPastDue,
        bucket,
      };
    });

    return {
      buckets: {
        current: buckets.current.toString(),
        days1To30: buckets.days1To30.toString(),
        days31To60: buckets.days31To60.toString(),
        days61To90: buckets.days61To90.toString(),
        days90Plus: buckets.days90Plus.toString(),
      },
      invoices: items,
    };
  }
}

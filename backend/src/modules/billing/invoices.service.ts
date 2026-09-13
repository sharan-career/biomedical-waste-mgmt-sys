import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RateCardComponent } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getFiscalYearLabel } from '../../common/utils/fiscal-year.util';
import { CancelInvoiceDto } from './dto/cancel-invoice.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

const INVOICE_INCLUDE = {
  customer: {
    select: { id: true, customerCode: true, organizationName: true },
  },
  contract: { select: { id: true, contractNumber: true } },
  lineItems: true,
} as const;

const COMPONENT_DESCRIPTIONS: Record<string, string> = {
  FIXED_FEE: 'Common Bio-Medical Waste Service Charges (Fixed)',
  PER_PICKUP: 'Common Bio-Medical Waste Service Charges (Per Pickup)',
  PER_BED: 'Common Bio-Medical Waste Service Charges (Per Bed)',
  SERVICE_CHARGE: 'Service Charges',
  DISCOUNT: 'Discount',
};

interface ComputedLine {
  description: string;
  lineType: RateCardComponent['componentType'];
  quantity: Decimal;
  unitAmount: Decimal;
  lineAmount: Decimal;
  taxableAmount: Decimal;
  cgstRatePercent: Decimal;
  cgstAmount: Decimal;
  sgstRatePercent: Decimal;
  sgstAmount: Decimal;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async generate(dto: GenerateInvoiceDto, actorUserId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
      include: {
        customer: true,
        activeRateCard: { include: { components: true } },
      },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    if (contract.status !== 'ACTIVE' || !contract.activeRateCard) {
      throw new BadRequestException(
        'Contract has no active rate card to bill against',
      );
    }

    const invoiceDate = dto.invoiceDate
      ? new Date(dto.invoiceDate)
      : new Date();
    const paymentTermsDays =
      contract.paymentTermsDays ?? contract.customer.paymentTermsDays;
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);

    const lines = contract.activeRateCard.components.map((component) =>
      this.computeLine(component, contract.customer.bedCount),
    );
    if (lines.length === 0) {
      throw new BadRequestException(
        'Active rate card has no pricing components',
      );
    }

    const subtotal = lines.reduce(
      (sum, line) => sum.plus(line.taxableAmount),
      new Decimal(0),
    );
    const taxAmount = lines.reduce(
      (sum, line) => sum.plus(line.cgstAmount).plus(line.sgstAmount),
      new Decimal(0),
    );
    const totalAmount = lines.reduce(
      (sum, line) => sum.plus(line.lineAmount),
      new Decimal(0),
    );

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.nextInvoiceNumber(tx, invoiceDate);

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: contract.customerId,
          contractId: contract.id,
          invoiceDate,
          billingPeriodStart: new Date(dto.billingPeriodStart),
          billingPeriodEnd: new Date(dto.billingPeriodEnd),
          dueDate,
          subtotal,
          taxAmount,
          totalAmount,
          notes: dto.notes,
          createdBy: actorUserId,
          updatedBy: actorUserId,
          lineItems: { create: lines },
        },
        include: INVOICE_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'INVOICE_GENERATED',
        entityType: 'Invoice',
        entityId: invoice.id,
        newValue: { invoiceNumber, totalAmount: totalAmount.toString() },
      });

      return invoice;
    });
  }

  async findAll(query: InvoiceQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.InvoiceWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.contractId ? { contractId: query.contractId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { invoiceNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: INVOICE_INCLUDE,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  async findOneOrThrow(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  getOrgProfile() {
    return {
      name: this.configService.get<string>('ORG_NAME', ''),
      address: this.configService.get<string>('ORG_ADDRESS', ''),
      mobile: this.configService.get<string>('ORG_MOBILE', ''),
      email: this.configService.get<string>('ORG_EMAIL', ''),
      gstin: this.configService.get<string>('ORG_GSTIN', ''),
      stateName: this.configService.get<string>('ORG_STATE_NAME', ''),
      stateCode: this.configService.get<string>('ORG_STATE_CODE', ''),
      bankName: this.configService.get<string>('ORG_BANK_NAME', ''),
      bankAccountNo: this.configService.get<string>('ORG_BANK_ACCOUNT_NO', ''),
      bankBranchIfsc: this.configService.get<string>(
        'ORG_BANK_BRANCH_IFSC',
        '',
      ),
    };
  }

  async approve(id: string, actorUserId: string) {
    const invoice = await this.findOneOrThrow(id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only a DRAFT invoice can be approved');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: actorUserId,
          approvedAt: new Date(),
          updatedBy: actorUserId,
        },
        include: INVOICE_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'INVOICE_APPROVED',
        entityType: 'Invoice',
        entityId: id,
      });

      return updated;
    });
  }

  async markSent(id: string, actorUserId: string) {
    const invoice = await this.findOneOrThrow(id);
    if (invoice.status !== 'APPROVED') {
      throw new BadRequestException(
        'Only an APPROVED invoice can be marked as sent',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: { status: 'SENT', updatedBy: actorUserId },
        include: INVOICE_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'INVOICE_SENT',
        entityType: 'Invoice',
        entityId: id,
      });

      return updated;
    });
  }

  async cancel(id: string, dto: CancelInvoiceDto, actorUserId: string) {
    const invoice = await this.findOneOrThrow(id);
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Invoice is already cancelled');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledReason: dto.reason,
          updatedBy: actorUserId,
        },
        include: INVOICE_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'INVOICE_CANCELLED',
        entityType: 'Invoice',
        entityId: id,
        previousValue: { status: invoice.status },
        newValue: { status: 'CANCELLED', reason: dto.reason },
      });

      return updated;
    });
  }

  private computeLine(
    component: RateCardComponent,
    customerBedCount: number | null,
  ): ComputedLine {
    const quantity =
      component.componentType === 'PER_BED'
        ? new Decimal(customerBedCount ?? 1)
        : new Decimal(1);
    const unitAmount = new Decimal(component.unitAmount.toString());
    const lineAmount = quantity.times(unitAmount);

    if (!component.taxable) {
      return {
        description:
          COMPONENT_DESCRIPTIONS[component.componentType] ??
          component.componentType,
        lineType: component.componentType,
        quantity,
        unitAmount,
        lineAmount,
        taxableAmount: lineAmount,
        cgstRatePercent: new Decimal(0),
        cgstAmount: new Decimal(0),
        sgstRatePercent: new Decimal(0),
        sgstAmount: new Decimal(0),
      };
    }

    const cgstRatePercent = new Decimal(component.cgstRatePercent.toString());
    const sgstRatePercent = new Decimal(component.sgstRatePercent.toString());
    const totalRatePercent = cgstRatePercent.plus(sgstRatePercent);
    // amount is tax-inclusive — back out the taxable base, then split into CGST/SGST.
    const taxableAmount = lineAmount
      .dividedBy(new Decimal(1).plus(totalRatePercent.dividedBy(100)))
      .toDecimalPlaces(2);
    const cgstAmount = taxableAmount
      .times(cgstRatePercent)
      .dividedBy(100)
      .toDecimalPlaces(2);
    const sgstAmount = taxableAmount
      .times(sgstRatePercent)
      .dividedBy(100)
      .toDecimalPlaces(2);

    return {
      description:
        COMPONENT_DESCRIPTIONS[component.componentType] ??
        component.componentType,
      lineType: component.componentType,
      quantity,
      unitAmount,
      lineAmount,
      taxableAmount,
      cgstRatePercent,
      cgstAmount,
      sgstRatePercent,
      sgstAmount,
    };
  }

  private async nextInvoiceNumber(
    tx: Prisma.TransactionClient,
    invoiceDate: Date,
  ): Promise<string> {
    const sequence = await tx.invoiceSequence.upsert({
      where: { id: 'default' },
      update: { lastNumber: { increment: 1 } },
      create: { id: 'default', lastNumber: 1 },
    });
    const prefix = this.configService.get<string>(
      'INVOICE_NUMBER_PREFIX',
      'INV',
    );
    const fy = getFiscalYearLabel(invoiceDate);
    return `${prefix}/${fy}/${sequence.lastNumber}`;
  }
}

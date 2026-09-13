import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';

const CREDIT_NOTE_INCLUDE = { lineItems: true } as const;

@Injectable()
export class CreditNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    invoiceId: string,
    dto: CreateCreditNoteDto,
    actorUserId: string,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot issue a credit note against a cancelled invoice',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const creditNote = await tx.creditNote.create({
        data: {
          invoiceId,
          customerId: invoice.customerId,
          reason: dto.reason,
          amount: dto.amount,
          createdBy: actorUserId,
          updatedBy: actorUserId,
          lineItems: {
            create: [{ description: dto.reason, amount: dto.amount }],
          },
        },
        include: CREDIT_NOTE_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CREDIT_NOTE_CREATED',
        entityType: 'Invoice',
        entityId: invoiceId,
        newValue: { creditNoteId: creditNote.id, amount: dto.amount },
      });

      return creditNote;
    });
  }

  async findAllForInvoice(invoiceId: string) {
    return this.prisma.creditNote.findMany({
      where: { invoiceId },
      include: CREDIT_NOTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, actorUserId: string) {
    const creditNote = await this.findOneOrThrow(id);
    if (creditNote.status !== 'DRAFT') {
      throw new BadRequestException('Only a DRAFT credit note can be approved');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.creditNote.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: actorUserId,
          approvedAt: new Date(),
          updatedBy: actorUserId,
        },
        include: CREDIT_NOTE_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CREDIT_NOTE_APPROVED',
        entityType: 'Invoice',
        entityId: creditNote.invoiceId,
        newValue: { creditNoteId: id },
      });

      return updated;
    });
  }

  async apply(id: string, actorUserId: string) {
    const creditNote = await this.findOneOrThrow(id);
    if (creditNote.status !== 'APPROVED') {
      throw new BadRequestException(
        'Only an APPROVED credit note can be applied',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.creditNote.update({
        where: { id },
        data: { status: 'APPLIED', updatedBy: actorUserId },
        include: CREDIT_NOTE_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CREDIT_NOTE_APPLIED',
        entityType: 'Invoice',
        entityId: creditNote.invoiceId,
        newValue: { creditNoteId: id },
      });

      return updated;
    });
  }

  private async findOneOrThrow(id: string) {
    const creditNote = await this.prisma.creditNote.findUnique({
      where: { id },
    });
    if (!creditNote) {
      throw new NotFoundException('Credit note not found');
    }
    return creditNote;
  }
}

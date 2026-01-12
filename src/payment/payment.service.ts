import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createPaymentDto: CreatePaymentDto) {
    const { invoiceId, amount, paymentMethod, paymentDate, reference, notes } =
      createPaymentDto;

    // Verify invoice belongs to user
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Check if payment amount exceeds remaining balance
    const remainingBalance = invoice.amountDue - invoice.amountPaid;
    if (amount > remainingBalance) {
      throw new BadRequestException(
        `Payment amount exceeds remaining balance of ${remainingBalance}`,
      );
    }

    // Create payment
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId,
        amount,
        paymentMethod,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        reference,
        notes,
      },
      include: {
        invoice: {
          include: {
            customer: true,
          },
        },
      },
    });

    // Update invoice amountPaid and paymentStatus
    const newAmountPaid = invoice.amountPaid + amount;
    let newPaymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
    let newStatus:
      | 'DRAFT'
      | 'SENT'
      | 'VIEWED'
      | 'COMPLETED'
      | 'REJECTED'
      | undefined = undefined;

    if (newAmountPaid >= invoice.amountDue) {
      newPaymentStatus = 'PAID';
      newStatus = 'COMPLETED'; // Mark invoice as completed when fully paid
    } else if (newAmountPaid > 0) {
      newPaymentStatus = 'PARTIAL';
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus: newPaymentStatus,
        ...(newStatus && { status: newStatus }),
      },
    });

    return payment;
  }

  async findAll(userId: string) {
    return this.prisma.payment.findMany({
      where: {
        invoice: {
          userId,
        },
      },
      include: {
        invoice: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async findByInvoice(userId: string, invoiceId: string) {
    // Verify invoice belongs to user
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        invoice: {
          userId,
        },
      },
      include: {
        invoice: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async update(userId: string, id: string, updatePaymentDto: UpdatePaymentDto) {
    const payment = await this.findOne(userId, id);
    const { amount, paymentMethod, paymentDate, reference, notes } =
      updatePaymentDto;

    // If amount is changing, validate and update invoice
    if (amount !== undefined && amount !== payment.amount) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: payment.invoiceId },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      const amountDifference = amount - payment.amount;
      const newAmountPaid = invoice.amountPaid + amountDifference;

      if (newAmountPaid > invoice.amountDue) {
        throw new BadRequestException(
          'Payment amount would exceed invoice total',
        );
      }

      if (newAmountPaid < 0) {
        throw new BadRequestException('Payment amount cannot be negative');
      }

      // Update invoice paymentStatus
      let newPaymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
      if (newAmountPaid >= invoice.amountDue) {
        newPaymentStatus = 'PAID';
      } else if (newAmountPaid > 0) {
        newPaymentStatus = 'PARTIAL';
      }

      // If fully paid, mark as COMPLETED; if was COMPLETED but no longer paid, revert to SENT
      const statusUpdate =
        newPaymentStatus === 'PAID'
          ? { status: 'COMPLETED' as const }
          : invoice.status === 'COMPLETED'
            ? { status: 'SENT' as const }
            : {};

      await this.prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus: newPaymentStatus,
          ...statusUpdate,
        },
      });
    }

    return this.prisma.payment.update({
      where: { id },
      data: {
        amount,
        paymentMethod,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        reference,
        notes,
      },
      include: {
        invoice: {
          include: {
            customer: true,
          },
        },
      },
    });
  }

  async remove(userId: string, id: string) {
    const payment = await this.findOne(userId, id);

    // Update invoice amountPaid
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: payment.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const newAmountPaid = Math.max(0, invoice.amountPaid - payment.amount);

    // Determine new payment status
    let newPaymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
    if (newAmountPaid >= invoice.amountDue) {
      newPaymentStatus = 'PAID';
    } else if (newAmountPaid > 0) {
      newPaymentStatus = 'PARTIAL';
    }

    // If was COMPLETED but no longer fully paid, revert to SENT
    const statusUpdate =
      newPaymentStatus === 'PAID'
        ? {}
        : invoice.status === 'COMPLETED'
          ? { status: 'SENT' as const }
          : {};

    await this.prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus: newPaymentStatus,
        ...statusUpdate,
      },
    });

    return this.prisma.payment.delete({
      where: { id },
    });
  }

  async getPaymentSummary(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: {
          userId,
        },
      },
      include: {
        invoice: true,
      },
    });

    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

    const byMethod = payments.reduce(
      (acc, p) => {
        acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + p.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalReceived,
      paymentCount: payments.length,
      byMethod,
    };
  }
}

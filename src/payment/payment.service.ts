import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';
import PDFDocument from 'pdfkit';

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

  async generateReceipt(userId: string, id: string): Promise<Buffer> {
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
            user: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(24)
        .fillColor('#10b981')
        .text('PAYMENT RECEIPT', { align: 'right' });
      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text(`Receipt #${id.slice(-8).toUpperCase()}`, { align: 'right' });
      doc.moveDown(2);

      // From section
      doc.fontSize(10).fillColor('#6b7280').text('From:');
      doc.fontSize(12).fillColor('#1f2937').text(payment.invoice.user.username);
      doc.moveDown();

      // Received From section
      doc.fontSize(10).fillColor('#6b7280').text('Received From:');
      doc
        .fontSize(12)
        .fillColor('#1f2937')
        .text(payment.invoice.customer.companyName);
      if (payment.invoice.customer.contactPersonName) {
        doc
          .fontSize(10)
          .fillColor('#6b7280')
          .text(payment.invoice.customer.contactPersonName);
      }
      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text(payment.invoice.customer.email);
      doc.moveDown(2);

      // Payment details box
      const boxTop = doc.y;
      doc
        .rect(50, boxTop, 500, 120)
        .fillColor('#f0fdf4')
        .fill()
        .strokeColor('#10b981')
        .lineWidth(1)
        .stroke();

      doc.fillColor('#1f2937');
      let y = boxTop + 15;

      // Invoice Reference
      doc.fontSize(10).fillColor('#6b7280').text('Invoice Reference:', 70, y);
      doc
        .fontSize(12)
        .fillColor('#1f2937')
        .text(payment.invoice.number, 200, y);
      y += 25;

      // Payment Date
      doc.fontSize(10).fillColor('#6b7280').text('Payment Date:', 70, y);
      doc
        .fontSize(12)
        .fillColor('#1f2937')
        .text(this.formatDate(payment.paymentDate), 200, y);
      y += 25;

      // Payment Method
      doc.fontSize(10).fillColor('#6b7280').text('Payment Method:', 70, y);
      doc
        .fontSize(12)
        .fillColor('#1f2937')
        .text(this.formatPaymentMethod(payment.paymentMethod), 200, y);
      y += 25;

      // Reference (if available)
      if (payment.reference) {
        doc.fontSize(10).fillColor('#6b7280').text('Reference:', 70, y);
        doc.fontSize(12).fillColor('#1f2937').text(payment.reference, 200, y);
      }

      doc.y = boxTop + 140;
      doc.moveDown();

      // Amount section
      doc.rect(50, doc.y, 500, 60).fillColor('#10b981').fill();

      const amountBoxY = doc.y + 15;
      doc
        .fontSize(14)
        .fillColor('#ffffff')
        .text('Amount Received:', 70, amountBoxY);
      doc
        .fontSize(24)
        .fillColor('#ffffff')
        .text(this.formatCurrency(payment.amount), 70, amountBoxY + 20);

      doc.y = doc.y + 80;
      doc.moveDown();

      // Invoice Summary
      doc.fontSize(12).fillColor('#1f2937').text('Invoice Summary:', 50, doc.y);
      doc.moveDown(0.5);

      const summaryY = doc.y;
      doc.fontSize(10).fillColor('#6b7280');
      doc.text('Invoice Total:', 70, summaryY);
      doc
        .fillColor('#1f2937')
        .text(this.formatCurrency(payment.invoice.amountDue), 200, summaryY);

      doc.fillColor('#6b7280').text('Amount Paid:', 70, summaryY + 20);
      doc
        .fillColor('#1f2937')
        .text(
          this.formatCurrency(payment.invoice.amountPaid),
          200,
          summaryY + 20,
        );

      const remainingBalance =
        payment.invoice.amountDue - payment.invoice.amountPaid;
      doc.fillColor('#6b7280').text('Remaining Balance:', 70, summaryY + 40);
      doc
        .fillColor(remainingBalance > 0 ? '#ef4444' : '#10b981')
        .text(this.formatCurrency(remainingBalance), 200, summaryY + 40);

      // Notes
      if (payment.notes) {
        doc.y = summaryY + 70;
        doc.fontSize(10).fillColor('#6b7280').text('Notes:', 50, doc.y);
        doc
          .fillColor('#1f2937')
          .text(payment.notes, 50, doc.y + 15, { width: 500 });
      }

      // Footer
      doc.fontSize(10).fillColor('#6b7280');
      doc.text('Thank you for your payment!', 50, 700, {
        align: 'center',
        width: 500,
      });

      doc.end();
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(amount);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('ms-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  private formatPaymentMethod(method: string): string {
    const methods: Record<string, string> = {
      CASH: 'Cash',
      BANK_TRANSFER: 'Bank Transfer',
      CREDIT_CARD: 'Credit Card',
      DEBIT_CARD: 'Debit Card',
      CHEQUE: 'Cheque',
      OTHER: 'Other',
    };
    return methods[method] || method;
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PortalService {
  constructor(private prisma: PrismaService) {}

  // Dashboard
  async getDashboard(customerId: string) {
    const [invoices, estimates, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { customerId },
        include: { customer: true },
      }),
      this.prisma.estimate.findMany({
        where: { customerId },
      }),
      this.prisma.payment.findMany({
        where: {
          invoice: { customerId },
        },
        include: {
          invoice: true,
        },
      }),
    ]);

    const amountDue = invoices
      .filter((inv) =>
        ['UNPAID', 'PARTIAL', 'OVERDUE'].includes(inv.paymentStatus),
      )
      .reduce((sum, inv) => sum + (inv.amountDue - inv.amountPaid), 0);

    const dueInvoices = invoices
      .filter((inv) =>
        ['UNPAID', 'PARTIAL', 'OVERDUE'].includes(inv.paymentStatus),
      )
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )
      .slice(0, 5);

    const recentEstimates = estimates
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5);

    return {
      stats: {
        amountDue,
        invoiceCount: invoices.length,
        estimateCount: estimates.length,
        paymentCount: payments.length,
      },
      dueInvoices,
      recentEstimates,
    };
  }

  // Invoices
  async getCustomerInvoices(customerId: string) {
    return this.prisma.invoice.findMany({
      where: { customerId },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        tax: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCustomerInvoice(customerId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        customerId,
      },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
        tax: true,
        payments: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Mark as viewed if it was sent
    if (invoice.status === 'SENT') {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'VIEWED' },
      });
      invoice.status = 'VIEWED';
    }

    return invoice;
  }

  // Estimates
  async getCustomerEstimates(customerId: string) {
    return this.prisma.estimate.findMany({
      where: { customerId },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCustomerEstimate(customerId: string, estimateId: string) {
    const estimate = await this.prisma.estimate.findFirst({
      where: {
        id: estimateId,
        customerId,
      },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    // Mark as viewed if it was sent
    if (estimate.status === 'SENT') {
      await this.prisma.estimate.update({
        where: { id: estimateId },
        data: { status: 'VIEWED' },
      });
      estimate.status = 'VIEWED';
    }

    return estimate;
  }

  async acceptEstimate(customerId: string, estimateId: string) {
    const estimate = await this.prisma.estimate.findFirst({
      where: {
        id: estimateId,
        customerId,
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    if (!['SENT', 'VIEWED'].includes(estimate.status)) {
      throw new BadRequestException(
        'Estimate cannot be accepted in current status',
      );
    }

    // Update estimate status to ACCEPTED
    const updatedEstimate = await this.prisma.estimate.update({
      where: { id: estimateId },
      data: { status: 'ACCEPTED' },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    // Automatically convert to invoice
    await this.convertEstimateToInvoice(estimate);

    return updatedEstimate;
  }

  private async convertEstimateToInvoice(estimate: {
    id: string;
    userId: string;
    customerId: string;
    amountDue: number;
    notes: string | null;
    items: Array<{
      itemId: string;
      quantity: number;
    }>;
  }) {
    // Generate invoice number
    const invoiceCount = await this.prisma.invoice.count({
      where: { userId: estimate.userId },
    });
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(4, '0')}`;

    // Calculate due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Create the invoice from estimate data
    const invoice = await this.prisma.invoice.create({
      data: {
        number: invoiceNumber,
        userId: estimate.userId,
        customerId: estimate.customerId,
        dueDate,
        notes: estimate.notes,
        subTotal: estimate.amountDue,
        taxAmount: 0,
        amountDue: estimate.amountDue,
        amountPaid: 0,
        status: 'SENT',
        paymentStatus: 'UNPAID',
        items: {
          create: estimate.items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    return invoice;
  }

  async rejectEstimate(customerId: string, estimateId: string) {
    const estimate = await this.prisma.estimate.findFirst({
      where: {
        id: estimateId,
        customerId,
      },
    });

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    if (!['SENT', 'VIEWED'].includes(estimate.status)) {
      throw new BadRequestException(
        'Estimate cannot be rejected in current status',
      );
    }

    return this.prisma.estimate.update({
      where: { id: estimateId },
      data: { status: 'REJECTED' },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });
  }

  // Payments
  async getCustomerPayments(customerId: string) {
    return this.prisma.payment.findMany({
      where: {
        invoice: { customerId },
      },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            amountDue: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async getCustomerPayment(customerId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        invoice: { customerId },
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

  // Settings / Profile
  async getProfile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        companyName: true,
        contactPersonName: true,
        email: true,
        phone: true,
        shippingAddress: true,
        createdAt: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async updateProfile(
    customerId: string,
    data: {
      companyName?: string;
      contactPersonName?: string;
      phone?: string;
      shippingAddress?: string;
    },
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data,
      select: {
        id: true,
        companyName: true,
        contactPersonName: true,
        email: true,
        phone: true,
        shippingAddress: true,
        createdAt: true,
      },
    });
  }

  async changePassword(
    customerId: string,
    data: { currentPassword: string; newPassword: string },
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const isValidPassword = await bcrypt.compare(
      data.currentPassword,
      customer.password,
    );

    if (!isValidPassword) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }
}

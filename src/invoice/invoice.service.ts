import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import PDFDocument from 'pdfkit';

@Injectable()
export class InvoiceService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateInvoiceDto) {
    const { items, taxId, ...invoiceData } = dto;

    // Calculate subtotal from items
    const itemDetails = await this.prisma.item.findMany({
      where: {
        id: { in: items.map((i) => i.itemId) },
        userId,
      },
    });

    const subTotal = items.reduce((total, item) => {
      const itemDetail = itemDetails.find((i) => i.id === item.itemId);
      return total + (itemDetail?.price || 0) * item.quantity;
    }, 0);

    // Calculate tax if taxId is provided
    let taxAmount = 0;
    if (taxId) {
      const tax = await this.prisma.tax.findFirst({
        where: { id: taxId, userId },
      });
      if (tax) {
        taxAmount = (subTotal * tax.rate) / 100;
      }
    }

    const amountDue = subTotal + taxAmount;

    return this.prisma.invoice.create({
      data: {
        number: invoiceData.number,
        customerId: invoiceData.customerId,
        dueDate: new Date(invoiceData.dueDate),
        notes: invoiceData.notes,
        userId,
        taxId: taxId || null,
        subTotal,
        taxAmount,
        amountDue,
        items: {
          create: items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        customer: true,
        tax: true,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.invoice.findMany({
      where: { userId },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            contactPersonName: true,
            email: true,
          },
        },
        items: {
          include: {
            item: true,
          },
        },
        tax: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
        tax: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async update(id: string, userId: string, dto: UpdateInvoiceDto) {
    await this.findOne(id, userId);

    const { items, taxId, ...updateData } = dto;

    // If items are being updated, recalculate amounts
    let subTotal: number | undefined;
    let taxAmount: number | undefined;
    let amountDue: number | undefined;

    if (items) {
      const itemDetails = await this.prisma.item.findMany({
        where: {
          id: { in: items.map((i) => i.itemId) },
          userId,
        },
      });

      subTotal = items.reduce((total, item) => {
        const itemDetail = itemDetails.find((i) => i.id === item.itemId);
        return total + (itemDetail?.price || 0) * item.quantity;
      }, 0);

      // Delete existing items and create new ones
      await this.prisma.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });
    }

    // Get current invoice to check for existing values
    const currentInvoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    // Determine the final taxId
    const finalTaxId = taxId !== undefined ? taxId : currentInvoice?.taxId;
    const finalSubTotal =
      subTotal !== undefined ? subTotal : currentInvoice?.subTotal || 0;

    // Calculate tax
    taxAmount = 0;
    if (finalTaxId) {
      const tax = await this.prisma.tax.findFirst({
        where: { id: finalTaxId, userId },
      });
      if (tax) {
        taxAmount = (finalSubTotal * tax.rate) / 100;
      }
    }

    amountDue = finalSubTotal + taxAmount;

    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...updateData,
        dueDate: updateData.dueDate ? new Date(updateData.dueDate) : undefined,
        taxId: taxId !== undefined ? taxId : undefined,
        subTotal: subTotal !== undefined ? subTotal : undefined,
        taxAmount,
        amountDue,
        ...(items && {
          items: {
            create: items.map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
            })),
          },
        }),
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        customer: true,
        tax: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    // Delete related invoice items first
    await this.prisma.invoiceItem.deleteMany({
      where: { invoiceId: id },
    });

    return this.prisma.invoice.delete({
      where: { id },
    });
  }

  async updateStatus(
    id: string,
    userId: string,
    status:
      | 'DRAFT'
      | 'SENT'
      | 'VIEWED'
      | 'PAID'
      | 'UNPAID'
      | 'OVERDUE'
      | 'REJECTED',
  ) {
    await this.findOne(id, userId);

    return this.prisma.invoice.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        customer: true,
        tax: true,
      },
    });
  }

  async generatePdf(id: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
        tax: true,
        user: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).fillColor('#4f46e5').text('INVOICE', { align: 'right' });
      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text(invoice.number, { align: 'right' });
      doc.moveDown(2);

      // From section
      doc.fontSize(10).fillColor('#6b7280').text('From:');
      doc.fontSize(12).fillColor('#1f2937').text(invoice.user.username);
      doc.moveDown();

      // Bill To section
      doc.fontSize(10).fillColor('#6b7280').text('Bill To:');
      doc.fontSize(12).fillColor('#1f2937').text(invoice.customer.companyName);
      if (invoice.customer.contactPersonName) {
        doc
          .fontSize(10)
          .fillColor('#6b7280')
          .text(invoice.customer.contactPersonName);
      }
      doc.fontSize(10).fillColor('#6b7280').text(invoice.customer.email);
      doc.moveDown();

      // Invoice details
      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text(`Invoice Date: ${this.formatDate(invoice.createdAt)}`);
      doc.text(`Due Date: ${this.formatDate(invoice.dueDate)}`);
      doc.text(`Status: ${invoice.status}`);
      doc.moveDown(2);

      // Items table header
      const tableTop = doc.y;
      const itemX = 50;
      const qtyX = 280;
      const priceX = 350;
      const totalX = 450;

      doc.fontSize(10).fillColor('#4f46e5');
      doc.text('Item', itemX, tableTop);
      doc.text('Qty', qtyX, tableTop);
      doc.text('Price', priceX, tableTop);
      doc.text('Total', totalX, tableTop);

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .strokeColor('#e5e7eb')
        .stroke();

      // Items
      let y = tableTop + 25;
      doc.fillColor('#1f2937');

      for (const invoiceItem of invoice.items) {
        const itemTotal = invoiceItem.item.price * invoiceItem.quantity;
        doc.text(invoiceItem.item.name, itemX, y, { width: 220 });
        doc.text(invoiceItem.quantity.toString(), qtyX, y);
        doc.text(this.formatCurrency(invoiceItem.item.price), priceX, y);
        doc.text(this.formatCurrency(itemTotal), totalX, y);
        y += 20;
      }

      doc
        .moveTo(50, y + 5)
        .lineTo(550, y + 5)
        .strokeColor('#e5e7eb')
        .stroke();
      y += 20;

      // Subtotal
      doc.fontSize(10).fillColor('#6b7280');
      doc.text('Subtotal:', priceX, y);
      doc
        .fillColor('#1f2937')
        .text(this.formatCurrency(invoice.subTotal), totalX, y);
      y += 20;

      // Tax
      if (invoice.tax) {
        doc.fillColor('#6b7280').text(`Tax (${invoice.tax.rate}%):`, priceX, y);
        doc
          .fillColor('#1f2937')
          .text(this.formatCurrency(invoice.taxAmount), totalX, y);
        y += 20;
      }

      // Total
      doc.fontSize(12).fillColor('#4f46e5').text('Total:', priceX, y);
      doc.text(this.formatCurrency(invoice.amountDue), totalX, y);

      // Notes
      if (invoice.notes) {
        y += 40;
        doc.fontSize(10).fillColor('#6b7280').text('Notes:', 50, y);
        doc
          .fillColor('#1f2937')
          .text(invoice.notes, 50, y + 15, { width: 500 });
      }

      // Footer
      doc.fontSize(10).fillColor('#6b7280');
      doc.text('Thank you for your business!', 50, 700, {
        align: 'center',
        width: 500,
      });

      doc.end();
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }
}

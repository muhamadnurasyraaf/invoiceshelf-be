import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import PDFDocument from 'pdfkit';

@Injectable()
export class EstimateService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateEstimateDto) {
    const { items, ...estimateData } = dto;

    // Calculate total amount from items
    const itemDetails = await this.prisma.item.findMany({
      where: {
        id: { in: items.map((i) => i.itemId) },
        userId,
      },
    });

    const amountDue = items.reduce((total, item) => {
      const itemDetail = itemDetails.find((i) => i.id === item.itemId);
      return total + (itemDetail?.price || 0) * item.quantity;
    }, 0);

    return this.prisma.estimate.create({
      data: {
        number: estimateData.number,
        customerId: estimateData.customerId,
        expiryDate: new Date(estimateData.expiryDate),
        notes: estimateData.notes,
        userId,
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
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.estimate.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const estimate = await this.prisma.estimate.findFirst({
      where: { id, userId },
      include: {
        customer: true,
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

    return estimate;
  }

  async update(id: string, userId: string, dto: UpdateEstimateDto) {
    await this.findOne(id, userId);

    const { items, ...updateData } = dto;

    // If items are being updated, recalculate amount
    let amountDue: number | undefined;
    if (items) {
      const itemDetails = await this.prisma.item.findMany({
        where: {
          id: { in: items.map((i) => i.itemId) },
          userId,
        },
      });

      amountDue = items.reduce((total, item) => {
        const itemDetail = itemDetails.find((i) => i.id === item.itemId);
        return total + (itemDetail?.price || 0) * item.quantity;
      }, 0);

      // Delete existing items and create new ones
      await this.prisma.invoiceItem.deleteMany({
        where: { estimateId: id },
      });
    }

    return this.prisma.estimate.update({
      where: { id },
      data: {
        ...updateData,
        expiryDate: updateData.expiryDate
          ? new Date(updateData.expiryDate)
          : undefined,
        ...(amountDue !== undefined && { amountDue }),
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
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    // Delete related invoice items first
    await this.prisma.invoiceItem.deleteMany({
      where: { estimateId: id },
    });

    return this.prisma.estimate.delete({
      where: { id },
    });
  }

  async updateStatus(
    id: string,
    userId: string,
    status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED',
  ) {
    await this.findOne(id, userId);

    return this.prisma.estimate.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        customer: true,
      },
    });
  }

  async generatePdf(id: string): Promise<Buffer> {
    const estimate = await this.prisma.estimate.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
        user: true,
      },
    });

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
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
        .fillColor('#4f46e5')
        .text('ESTIMATE', { align: 'right' });
      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text(estimate.number, { align: 'right' });
      doc.moveDown(2);

      // From section
      doc.fontSize(10).fillColor('#6b7280').text('From:');
      doc.fontSize(12).fillColor('#1f2937').text(estimate.user.username);
      doc.moveDown();

      // To section
      doc.fontSize(10).fillColor('#6b7280').text('To:');
      doc.fontSize(12).fillColor('#1f2937').text(estimate.customer.companyName);
      if (estimate.customer.contactPersonName) {
        doc
          .fontSize(10)
          .fillColor('#6b7280')
          .text(estimate.customer.contactPersonName);
      }
      doc.fontSize(10).fillColor('#6b7280').text(estimate.customer.email);
      doc.moveDown();

      // Estimate details
      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text(`Estimate Date: ${this.formatDate(estimate.createdAt)}`);
      doc.text(`Expiry Date: ${this.formatDate(estimate.expiryDate)}`);
      doc.text(`Status: ${estimate.status}`);
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

      for (const estimateItem of estimate.items) {
        const itemTotal = estimateItem.item.price * estimateItem.quantity;
        doc.text(estimateItem.item.name, itemX, y, { width: 220 });
        doc.text(estimateItem.quantity.toString(), qtyX, y);
        doc.text(this.formatCurrency(estimateItem.item.price), priceX, y);
        doc.text(this.formatCurrency(itemTotal), totalX, y);
        y += 20;
      }

      doc
        .moveTo(50, y + 5)
        .lineTo(550, y + 5)
        .strokeColor('#e5e7eb')
        .stroke();
      y += 20;

      // Total
      doc.fontSize(12).fillColor('#4f46e5').text('Total:', priceX, y);
      doc.text(this.formatCurrency(estimate.amountDue), totalX, y);

      // Notes
      if (estimate.notes) {
        y += 40;
        doc.fontSize(10).fillColor('#6b7280').text('Notes:', 50, y);
        doc
          .fillColor('#1f2937')
          .text(estimate.notes, 50, y + 15, { width: 500 });
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
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(amount);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('ms-MY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}

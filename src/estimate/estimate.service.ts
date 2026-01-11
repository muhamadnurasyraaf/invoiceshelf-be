import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';

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
}

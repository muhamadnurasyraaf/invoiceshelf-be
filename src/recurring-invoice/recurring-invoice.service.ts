import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringInvoiceDto } from './dto/create-recurring-invoice.dto';
import { UpdateRecurringInvoiceDto } from './dto/update-recurring-invoice.dto';

@Injectable()
export class RecurringInvoiceService {
  constructor(private prisma: PrismaService) {}

  private calculateNextInvoiceDate(
    frequency: string,
    startDate: Date,
    dayOfMonth?: number,
    dayOfWeek?: number,
  ): Date {
    const now = new Date();
    let nextDate = new Date(startDate);

    // If start date is in the future, use it
    if (nextDate > now) {
      return this.adjustToScheduledDay(nextDate, frequency, dayOfMonth, dayOfWeek);
    }

    // Calculate next occurrence based on frequency
    switch (frequency) {
      case 'DAILY':
        nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'WEEKLY':
        nextDate = new Date(now);
        const targetDay = dayOfWeek ?? 1; // Default to Monday
        const currentDay = nextDate.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
        nextDate.setDate(nextDate.getDate() + daysUntilTarget);
        break;
      case 'MONTHLY':
        nextDate = new Date(now);
        nextDate.setMonth(nextDate.getMonth() + 1);
        if (dayOfMonth) {
          nextDate.setDate(Math.min(dayOfMonth, this.getDaysInMonth(nextDate)));
        }
        break;
      case 'YEARLY':
        nextDate = new Date(now);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    return nextDate;
  }

  private adjustToScheduledDay(
    date: Date,
    frequency: string,
    dayOfMonth?: number,
    dayOfWeek?: number,
  ): Date {
    const adjusted = new Date(date);

    if (frequency === 'WEEKLY' && dayOfWeek !== undefined) {
      const currentDay = adjusted.getDay();
      const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
      adjusted.setDate(adjusted.getDate() + daysUntilTarget);
    } else if (frequency === 'MONTHLY' && dayOfMonth) {
      adjusted.setDate(Math.min(dayOfMonth, this.getDaysInMonth(adjusted)));
    }

    return adjusted;
  }

  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  async create(userId: string, dto: CreateRecurringInvoiceDto) {
    const { items, ...data } = dto;

    const startDate = new Date(data.startDate);
    const nextInvoiceDate = this.calculateNextInvoiceDate(
      data.frequency,
      startDate,
      data.dayOfMonth,
      data.dayOfWeek,
    );

    return this.prisma.recurringInvoice.create({
      data: {
        name: data.name,
        customerId: data.customerId,
        frequency: data.frequency,
        startDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        nextInvoiceDate,
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
        dueAfterDays: data.dueAfterDays ?? 30,
        notes: data.notes,
        userId,
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
    return this.prisma.recurringInvoice.findMany({
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
    const recurringInvoice = await this.prisma.recurringInvoice.findFirst({
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

    if (!recurringInvoice) {
      throw new NotFoundException('Recurring invoice not found');
    }

    return recurringInvoice;
  }

  async update(id: string, userId: string, dto: UpdateRecurringInvoiceDto) {
    const existing = await this.findOne(id, userId);

    const { items, ...updateData } = dto;

    // Recalculate next invoice date if frequency or schedule changed
    let nextInvoiceDate: Date | undefined;
    if (updateData.frequency || updateData.startDate || updateData.dayOfMonth || updateData.dayOfWeek) {
      const frequency = updateData.frequency || existing.frequency;
      const startDate = updateData.startDate ? new Date(updateData.startDate) : existing.startDate;
      const dayOfMonth = updateData.dayOfMonth ?? existing.dayOfMonth;
      const dayOfWeek = updateData.dayOfWeek ?? existing.dayOfWeek;

      nextInvoiceDate = this.calculateNextInvoiceDate(
        frequency,
        startDate,
        dayOfMonth ?? undefined,
        dayOfWeek ?? undefined,
      );
    }

    // Delete existing items if updating
    if (items) {
      await this.prisma.recurringInvoiceItem.deleteMany({
        where: { recurringInvoiceId: id },
      });
    }

    return this.prisma.recurringInvoice.update({
      where: { id },
      data: {
        ...updateData,
        startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
        endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
        ...(nextInvoiceDate && { nextInvoiceDate }),
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

    // Delete related items first
    await this.prisma.recurringInvoiceItem.deleteMany({
      where: { recurringInvoiceId: id },
    });

    return this.prisma.recurringInvoice.delete({
      where: { id },
    });
  }

  async updateStatus(
    id: string,
    userId: string,
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED',
  ) {
    await this.findOne(id, userId);

    return this.prisma.recurringInvoice.update({
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

  // Get all active recurring invoices due for generation
  async findDueForGeneration() {
    const now = new Date();
    return this.prisma.recurringInvoice.findMany({
      where: {
        status: 'ACTIVE',
        nextInvoiceDate: {
          lte: now,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        customer: true,
        user: true,
      },
    });
  }

  // Update after invoice generation
  async markAsGenerated(id: string) {
    const recurring = await this.prisma.recurringInvoice.findUnique({
      where: { id },
    });

    if (!recurring) return;

    const nextDate = this.calculateNextInvoiceDate(
      recurring.frequency,
      recurring.nextInvoiceDate,
      recurring.dayOfMonth ?? undefined,
      recurring.dayOfWeek ?? undefined,
    );

    // Check if we've passed the end date
    const isCompleted = recurring.endDate && nextDate > recurring.endDate;

    return this.prisma.recurringInvoice.update({
      where: { id },
      data: {
        lastGeneratedAt: new Date(),
        generatedCount: { increment: 1 },
        nextInvoiceDate: nextDate,
        status: isCompleted ? 'COMPLETED' : 'ACTIVE',
      },
    });
  }
}

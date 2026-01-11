import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto';

@Injectable()
export class ExpenseService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createExpenseDto: CreateExpenseDto) {
    const {
      description,
      amount,
      category,
      expenseDate,
      vendor,
      reference,
      notes,
      receipt,
    } = createExpenseDto;

    return this.prisma.expense.create({
      data: {
        description,
        amount,
        category,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        vendor,
        reference,
        notes,
        receipt,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.expense.findMany({
      where: { userId },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, userId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  async update(userId: string, id: string, updateExpenseDto: UpdateExpenseDto) {
    await this.findOne(userId, id);

    const {
      description,
      amount,
      category,
      expenseDate,
      vendor,
      reference,
      notes,
      receipt,
    } = updateExpenseDto;

    return this.prisma.expense.update({
      where: { id },
      data: {
        description,
        amount,
        category,
        expenseDate: expenseDate ? new Date(expenseDate) : undefined,
        vendor,
        reference,
        notes,
        receipt,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.expense.delete({
      where: { id },
    });
  }

  async getSummary(userId: string) {
    const expenses = await this.prisma.expense.findMany({
      where: { userId },
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const byCategory = expenses.reduce(
      (acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get monthly breakdown for current year
    const currentYear = new Date().getFullYear();
    const monthlyExpenses = await this.prisma.expense.groupBy({
      by: ['expenseDate'],
      where: {
        userId,
        expenseDate: {
          gte: new Date(currentYear, 0, 1),
          lte: new Date(currentYear, 11, 31),
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Aggregate by month
    const monthly: Record<number, number> = {};
    for (let i = 0; i < 12; i++) {
      monthly[i] = 0;
    }

    expenses
      .filter((e) => new Date(e.expenseDate).getFullYear() === currentYear)
      .forEach((e) => {
        const month = new Date(e.expenseDate).getMonth();
        monthly[month] = (monthly[month] || 0) + e.amount;
      });

    return {
      totalExpenses,
      expenseCount: expenses.length,
      byCategory,
      monthly,
    };
  }
}

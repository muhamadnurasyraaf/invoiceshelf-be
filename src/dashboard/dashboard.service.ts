import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: string) {
    console.log('Dashboard getStats called with userId:', userId);

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    // Get all invoices for the user
    const invoices = await this.prisma.invoice.findMany({
      where: { userId },
      include: { payments: true },
    });

    console.log('Found invoices:', invoices.length);

    // Get all expenses for the user
    const expenses = await this.prisma.expense.findMany({
      where: { userId },
    });

    // Get all customers
    const customers = await this.prisma.customer.findMany({
      where: { userId },
    });

    // Get all estimates
    const estimates = await this.prisma.estimate.findMany({
      where: { userId },
    });

    // Calculate totals
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amountDue, 0);
    const totalReceived = invoices.reduce(
      (sum, inv) => sum + inv.amountPaid,
      0,
    );
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netIncome = totalReceived - totalExpenses;
    const totalOutstanding = totalInvoiced - totalReceived;

    // Count by status
    const invoicesByStatus = invoices.reduce(
      (acc, inv) => {
        acc[inv.status] = (acc[inv.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const estimatesByStatus = estimates.reduce(
      (acc, est) => {
        acc[est.status] = (acc[est.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Monthly data for charts
    const monthlyData = this.calculateMonthlyData(
      invoices,
      expenses,
      currentYear,
    );

    // Expense breakdown by category
    const expensesByCategory = expenses.reduce(
      (acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Recent activity
    const recentInvoices = await this.prisma.invoice.findMany({
      where: { userId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentPayments = await this.prisma.payment.findMany({
      where: { invoice: { userId } },
      include: { invoice: { include: { customer: true } } },
      orderBy: { paymentDate: 'desc' },
      take: 5,
    });

    const recentExpenses = await this.prisma.expense.findMany({
      where: { userId },
      orderBy: { expenseDate: 'desc' },
      take: 5,
    });

    // Overdue invoices
    const overdueInvoices = invoices.filter(
      (inv) =>
        inv.paymentStatus !== 'PAID' &&
        inv.status !== 'DRAFT' &&
        new Date(inv.dueDate) < new Date(),
    );

    return {
      summary: {
        totalInvoiced,
        totalReceived,
        totalExpenses,
        netIncome,
        totalOutstanding,
        customerCount: customers.length,
        invoiceCount: invoices.length,
        estimateCount: estimates.length,
        overdueCount: overdueInvoices.length,
      },
      invoicesByStatus,
      estimatesByStatus,
      monthlyData,
      expensesByCategory,
      recentActivity: {
        invoices: recentInvoices,
        payments: recentPayments,
        expenses: recentExpenses,
      },
      overdueInvoices: overdueInvoices.slice(0, 5),
    };
  }

  private calculateMonthlyData(invoices: any[], expenses: any[], year: number) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const monthlyIncome: number[] = new Array(12).fill(0);
    const monthlyExpenses: number[] = new Array(12).fill(0);

    // Calculate monthly income from payments
    invoices.forEach((invoice) => {
      if (invoice.payments) {
        invoice.payments.forEach((payment: any) => {
          const paymentDate = new Date(payment.paymentDate);
          if (paymentDate.getFullYear() === year) {
            const month = paymentDate.getMonth();
            monthlyIncome[month] += payment.amount;
          }
        });
      }
    });

    // Calculate monthly expenses
    expenses.forEach((expense) => {
      const expenseDate = new Date(expense.expenseDate);
      if (expenseDate.getFullYear() === year) {
        const month = expenseDate.getMonth();
        monthlyExpenses[month] += expense.amount;
      }
    });

    // Calculate net income per month
    const monthlyNetIncome = monthlyIncome.map(
      (income, i) => income - monthlyExpenses[i],
    );

    return {
      labels: months,
      income: monthlyIncome,
      expenses: monthlyExpenses,
      netIncome: monthlyNetIncome,
    };
  }
}

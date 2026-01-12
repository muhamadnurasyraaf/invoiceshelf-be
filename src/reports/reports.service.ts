import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getProfitLossReport(userId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: { userId },
      include: { payments: true },
    });

    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        expenseDate: { gte: startDate, lte: endDate },
      },
    });

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

    const monthlyData = months.map((month, index) => {
      const monthStart = new Date(year, index, 1);
      const monthEnd = new Date(year, index + 1, 0, 23, 59, 59);

      // Calculate income from payments in this month
      let income = 0;
      invoices.forEach((invoice) => {
        invoice.payments.forEach((payment) => {
          const paymentDate = new Date(payment.paymentDate);
          if (paymentDate >= monthStart && paymentDate <= monthEnd) {
            income += payment.amount;
          }
        });
      });

      // Calculate expenses in this month
      const monthExpenses = expenses
        .filter((exp) => {
          const expDate = new Date(exp.expenseDate);
          return expDate >= monthStart && expDate <= monthEnd;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);

      return {
        month,
        income,
        expenses: monthExpenses,
        profit: income - monthExpenses,
      };
    });

    const totals = monthlyData.reduce(
      (acc, month) => ({
        income: acc.income + month.income,
        expenses: acc.expenses + month.expenses,
        profit: acc.profit + month.profit,
      }),
      { income: 0, expenses: 0, profit: 0 },
    );

    return {
      year,
      monthlyData,
      totals,
    };
  }

  async getSalesReport(userId: string, year: number) {
    const invoices = await this.prisma.invoice.findMany({
      where: { userId },
      include: {
        customer: true,
        payments: true,
        items: { include: { item: true } },
      },
    });

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

    // Monthly sales data
    const monthlySales = months.map((month, index) => {
      const monthStart = new Date(year, index, 1);
      const monthEnd = new Date(year, index + 1, 0, 23, 59, 59);

      const monthInvoices = invoices.filter((inv) => {
        const invDate = new Date(inv.createdAt);
        return invDate >= monthStart && invDate <= monthEnd;
      });

      const invoiced = monthInvoices.reduce(
        (sum, inv) => sum + inv.amountDue,
        0,
      );
      const collected = monthInvoices.reduce(
        (sum, inv) => sum + inv.amountPaid,
        0,
      );
      const count = monthInvoices.length;

      return { month, invoiced, collected, count };
    });

    // Sales by customer
    const salesByCustomer = invoices.reduce(
      (acc, inv) => {
        const customerId = inv.customerId;
        const customerName = inv.customer.companyName;

        if (!acc[customerId]) {
          acc[customerId] = {
            customerId,
            customerName,
            totalInvoiced: 0,
            totalPaid: 0,
            invoiceCount: 0,
          };
        }

        acc[customerId].totalInvoiced += inv.amountDue;
        acc[customerId].totalPaid += inv.amountPaid;
        acc[customerId].invoiceCount += 1;

        return acc;
      },
      {} as Record<
        string,
        {
          customerId: string;
          customerName: string;
          totalInvoiced: number;
          totalPaid: number;
          invoiceCount: number;
        }
      >,
    );

    // Sales by item
    const salesByItem: Record<
      string,
      { itemId: string; itemName: string; quantity: number; revenue: number }
    > = {};

    invoices.forEach((inv) => {
      inv.items.forEach((invItem) => {
        const itemId = invItem.itemId;
        const itemName = invItem.item.name;
        const quantity = invItem.quantity;
        const revenue = invItem.item.price * invItem.quantity;

        if (!salesByItem[itemId]) {
          salesByItem[itemId] = { itemId, itemName, quantity: 0, revenue: 0 };
        }

        salesByItem[itemId].quantity += quantity;
        salesByItem[itemId].revenue += revenue;
      });
    });

    const totals = {
      totalInvoiced: invoices.reduce((sum, inv) => sum + inv.amountDue, 0),
      totalCollected: invoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
      totalOutstanding: invoices.reduce(
        (sum, inv) => sum + (inv.amountDue - inv.amountPaid),
        0,
      ),
      invoiceCount: invoices.length,
    };

    return {
      year,
      monthlySales,
      salesByCustomer: Object.values(salesByCustomer).sort(
        (a, b) => b.totalInvoiced - a.totalInvoiced,
      ),
      salesByItem: Object.values(salesByItem).sort(
        (a, b) => b.revenue - a.revenue,
      ),
      totals,
    };
  }

  async getExpenseReport(userId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        expenseDate: { gte: startDate, lte: endDate },
      },
      orderBy: { expenseDate: 'desc' },
    });

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

    // Monthly expenses
    const monthlyExpenses = months.map((month, index) => {
      const monthStart = new Date(year, index, 1);
      const monthEnd = new Date(year, index + 1, 0, 23, 59, 59);

      const monthExp = expenses
        .filter((exp) => {
          const expDate = new Date(exp.expenseDate);
          return expDate >= monthStart && expDate <= monthEnd;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);

      return { month, amount: monthExp };
    });

    // Expenses by category
    const expensesByCategory = expenses.reduce(
      (acc, exp) => {
        if (!acc[exp.category]) {
          acc[exp.category] = { category: exp.category, amount: 0, count: 0 };
        }
        acc[exp.category].amount += exp.amount;
        acc[exp.category].count += 1;
        return acc;
      },
      {} as Record<string, { category: string; amount: number; count: number }>,
    );

    // Expenses by vendor
    const expensesByVendor = expenses.reduce(
      (acc, exp) => {
        const vendor = exp.vendor || 'Unknown';
        if (!acc[vendor]) {
          acc[vendor] = { vendor, amount: 0, count: 0 };
        }
        acc[vendor].amount += exp.amount;
        acc[vendor].count += 1;
        return acc;
      },
      {} as Record<string, { vendor: string; amount: number; count: number }>,
    );

    const totals = {
      totalExpenses: expenses.reduce((sum, exp) => sum + exp.amount, 0),
      expenseCount: expenses.length,
      averageExpense:
        expenses.length > 0
          ? expenses.reduce((sum, exp) => sum + exp.amount, 0) / expenses.length
          : 0,
    };

    return {
      year,
      monthlyExpenses,
      expensesByCategory: Object.values(expensesByCategory).sort(
        (a, b) => b.amount - a.amount,
      ),
      expensesByVendor: Object.values(expensesByVendor).sort(
        (a, b) => b.amount - a.amount,
      ),
      totals,
    };
  }

  async getCustomerReport(userId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { userId },
      include: {
        invoices: {
          include: { payments: true },
        },
      },
    });

    const customerStats = customers.map((customer) => {
      const totalInvoiced = customer.invoices.reduce(
        (sum, inv) => sum + inv.amountDue,
        0,
      );
      const totalPaid = customer.invoices.reduce(
        (sum, inv) => sum + inv.amountPaid,
        0,
      );
      const outstanding = totalInvoiced - totalPaid;
      const invoiceCount = customer.invoices.length;
      const paidInvoices = customer.invoices.filter(
        (inv) => inv.paymentStatus === 'PAID',
      ).length;
      const overdueInvoices = customer.invoices.filter(
        (inv) =>
          inv.paymentStatus !== 'PAID' &&
          inv.status !== 'DRAFT' &&
          new Date(inv.dueDate) < new Date(),
      ).length;

      return {
        customerId: customer.id,
        companyName: customer.companyName,
        contactPerson: customer.contactPersonName,
        email: customer.email,
        totalInvoiced,
        totalPaid,
        outstanding,
        invoiceCount,
        paidInvoices,
        overdueInvoices,
      };
    });

    const totals = {
      totalCustomers: customers.length,
      totalInvoiced: customerStats.reduce((sum, c) => sum + c.totalInvoiced, 0),
      totalCollected: customerStats.reduce((sum, c) => sum + c.totalPaid, 0),
      totalOutstanding: customerStats.reduce(
        (sum, c) => sum + c.outstanding,
        0,
      ),
    };

    return {
      customers: customerStats.sort(
        (a, b) => b.totalInvoiced - a.totalInvoiced,
      ),
      totals,
    };
  }

  async getTaxReport(userId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
        taxId: { not: null },
      },
      include: { tax: true },
    });

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

    // Monthly tax collected
    const monthlyTax = months.map((month, index) => {
      const monthStart = new Date(year, index, 1);
      const monthEnd = new Date(year, index + 1, 0, 23, 59, 59);

      const monthTax = invoices
        .filter((inv) => {
          const invDate = new Date(inv.createdAt);
          return invDate >= monthStart && invDate <= monthEnd;
        })
        .reduce((sum, inv) => sum + inv.taxAmount, 0);

      return { month, taxAmount: monthTax };
    });

    // Tax by tax type
    const taxByType = invoices.reduce(
      (acc, inv) => {
        if (!inv.tax) return acc;

        const taxId = inv.taxId!;
        const taxName = inv.tax.name;
        const taxRate = inv.tax.rate;

        if (!acc[taxId]) {
          acc[taxId] = {
            taxId,
            taxName,
            taxRate,
            taxAmount: 0,
            invoiceCount: 0,
          };
        }

        acc[taxId].taxAmount += inv.taxAmount;
        acc[taxId].invoiceCount += 1;

        return acc;
      },
      {} as Record<
        string,
        {
          taxId: string;
          taxName: string;
          taxRate: number;
          taxAmount: number;
          invoiceCount: number;
        }
      >,
    );

    const totals = {
      totalTaxCollected: invoices.reduce((sum, inv) => sum + inv.taxAmount, 0),
      totalTaxableAmount: invoices.reduce((sum, inv) => sum + inv.subTotal, 0),
      invoiceCount: invoices.length,
    };

    return {
      year,
      monthlyTax,
      taxByType: Object.values(taxByType).sort(
        (a, b) => b.taxAmount - a.taxAmount,
      ),
      totals,
    };
  }

  async getPaymentReport(userId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: { userId },
        paymentDate: { gte: startDate, lte: endDate },
      },
      include: {
        invoice: {
          include: { customer: true },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

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

    // Monthly payments
    const monthlyPayments = months.map((month, index) => {
      const monthStart = new Date(year, index, 1);
      const monthEnd = new Date(year, index + 1, 0, 23, 59, 59);

      const monthPay = payments
        .filter((pay) => {
          const payDate = new Date(pay.paymentDate);
          return payDate >= monthStart && payDate <= monthEnd;
        })
        .reduce((sum, pay) => sum + pay.amount, 0);

      return { month, amount: monthPay };
    });

    // Payments by method
    const paymentsByMethod = payments.reduce(
      (acc, pay) => {
        const method = pay.paymentMethod;
        if (!acc[method]) {
          acc[method] = { method, amount: 0, count: 0 };
        }
        acc[method].amount += pay.amount;
        acc[method].count += 1;
        return acc;
      },
      {} as Record<string, { method: string; amount: number; count: number }>,
    );

    const totals = {
      totalPayments: payments.reduce((sum, pay) => sum + pay.amount, 0),
      paymentCount: payments.length,
      averagePayment:
        payments.length > 0
          ? payments.reduce((sum, pay) => sum + pay.amount, 0) / payments.length
          : 0,
    };

    return {
      year,
      monthlyPayments,
      paymentsByMethod: Object.values(paymentsByMethod).sort(
        (a, b) => b.amount - a.amount,
      ),
      totals,
    };
  }

  // PDF Generation Methods
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(amount);
  }

  async generateProfitLossPdf(userId: string, year: number): Promise<Buffer> {
    const report = await this.getProfitLossReport(userId, year);

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
        .text('Profit & Loss Report', { align: 'center' });
      doc
        .fontSize(14)
        .fillColor('#6b7280')
        .text(`Year: ${year}`, { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(16).fillColor('#1f2937').text('Summary');
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor('#059669')
        .text(`Total Income: ${this.formatCurrency(report.totals.income)}`);
      doc
        .fillColor('#dc2626')
        .text(`Total Expenses: ${this.formatCurrency(report.totals.expenses)}`);
      doc
        .fillColor(report.totals.profit >= 0 ? '#059669' : '#dc2626')
        .text(`Net Profit: ${this.formatCurrency(report.totals.profit)}`);
      doc.moveDown(2);

      // Monthly Breakdown Table
      doc.fontSize(16).fillColor('#1f2937').text('Monthly Breakdown');
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const colWidths = [80, 120, 120, 120];
      const headers = ['Month', 'Income', 'Expenses', 'Profit'];

      // Table header
      doc.fontSize(10).fillColor('#4f46e5');
      let x = 50;
      headers.forEach((header, i) => {
        doc.text(header, x, tableTop, { width: colWidths[i] });
        x += colWidths[i];
      });

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(490, tableTop + 15)
        .strokeColor('#e5e7eb')
        .stroke();

      // Table rows
      let y = tableTop + 25;
      doc.fillColor('#1f2937');
      report.monthlyData.forEach((row) => {
        x = 50;
        doc.text(row.month, x, y, { width: colWidths[0] });
        x += colWidths[0];
        doc
          .fillColor('#059669')
          .text(this.formatCurrency(row.income), x, y, { width: colWidths[1] });
        x += colWidths[1];
        doc.fillColor('#dc2626').text(this.formatCurrency(row.expenses), x, y, {
          width: colWidths[2],
        });
        x += colWidths[2];
        doc
          .fillColor(row.profit >= 0 ? '#059669' : '#dc2626')
          .text(this.formatCurrency(row.profit), x, y, { width: colWidths[3] });
        doc.fillColor('#1f2937');
        y += 20;
      });

      // Footer
      doc.fontSize(10).fillColor('#6b7280');
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 50, 700, {
        align: 'center',
        width: 500,
      });

      doc.end();
    });
  }

  async generateSalesPdf(userId: string, year: number): Promise<Buffer> {
    const report = await this.getSalesReport(userId, year);

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
        .text('Sales Report', { align: 'center' });
      doc
        .fontSize(14)
        .fillColor('#6b7280')
        .text(`Year: ${year}`, { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(16).fillColor('#1f2937').text('Summary');
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor('#1f2937')
        .text(
          `Total Invoiced: ${this.formatCurrency(report.totals.totalInvoiced)}`,
        );
      doc
        .fillColor('#059669')
        .text(
          `Total Collected: ${this.formatCurrency(report.totals.totalCollected)}`,
        );
      doc
        .fillColor('#dc2626')
        .text(
          `Outstanding: ${this.formatCurrency(report.totals.totalOutstanding)}`,
        );
      doc
        .fillColor('#1f2937')
        .text(`Total Invoices: ${report.totals.invoiceCount}`);
      doc.moveDown(2);

      // Top Customers
      doc.fontSize(16).fillColor('#1f2937').text('Top Customers');
      doc.moveDown(0.5);

      const topCustomers = report.salesByCustomer.slice(0, 10);
      topCustomers.forEach((customer, i) => {
        doc
          .fontSize(10)
          .fillColor('#1f2937')
          .text(
            `${i + 1}. ${customer.customerName} - Invoiced: ${this.formatCurrency(customer.totalInvoiced)}, Paid: ${this.formatCurrency(customer.totalPaid)}`,
          );
      });

      doc.moveDown(2);

      // Top Items
      doc.fontSize(16).fillColor('#1f2937').text('Top Items');
      doc.moveDown(0.5);

      const topItems = report.salesByItem.slice(0, 10);
      topItems.forEach((item, i) => {
        doc
          .fontSize(10)
          .fillColor('#1f2937')
          .text(
            `${i + 1}. ${item.itemName} - Qty: ${item.quantity}, Revenue: ${this.formatCurrency(item.revenue)}`,
          );
      });

      // Footer
      doc.fontSize(10).fillColor('#6b7280');
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 50, 700, {
        align: 'center',
        width: 500,
      });

      doc.end();
    });
  }

  async generateExpensesPdf(userId: string, year: number): Promise<Buffer> {
    const report = await this.getExpenseReport(userId, year);

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
        .text('Expense Report', { align: 'center' });
      doc
        .fontSize(14)
        .fillColor('#6b7280')
        .text(`Year: ${year}`, { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(16).fillColor('#1f2937').text('Summary');
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor('#dc2626')
        .text(
          `Total Expenses: ${this.formatCurrency(report.totals.totalExpenses)}`,
        );
      doc
        .fillColor('#1f2937')
        .text(`Expense Count: ${report.totals.expenseCount}`);
      doc.text(
        `Average Expense: ${this.formatCurrency(report.totals.averageExpense)}`,
      );
      doc.moveDown(2);

      // By Category
      doc.fontSize(16).fillColor('#1f2937').text('Expenses by Category');
      doc.moveDown(0.5);

      report.expensesByCategory.forEach((cat) => {
        doc
          .fontSize(10)
          .fillColor('#1f2937')
          .text(
            `${cat.category.replace(/_/g, ' ')} - ${this.formatCurrency(cat.amount)} (${cat.count} expenses)`,
          );
      });

      doc.moveDown(2);

      // By Vendor
      doc.fontSize(16).fillColor('#1f2937').text('Top Vendors');
      doc.moveDown(0.5);

      report.expensesByVendor.slice(0, 10).forEach((vendor) => {
        doc
          .fontSize(10)
          .fillColor('#1f2937')
          .text(
            `${vendor.vendor} - ${this.formatCurrency(vendor.amount)} (${vendor.count} expenses)`,
          );
      });

      // Footer
      doc.fontSize(10).fillColor('#6b7280');
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 50, 700, {
        align: 'center',
        width: 500,
      });

      doc.end();
    });
  }

  async generateCustomersPdf(userId: string): Promise<Buffer> {
    const report = await this.getCustomerReport(userId);

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
        .text('Customer Report', { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(16).fillColor('#1f2937').text('Summary');
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor('#1f2937')
        .text(`Total Customers: ${report.totals.totalCustomers}`);
      doc.text(
        `Total Invoiced: ${this.formatCurrency(report.totals.totalInvoiced)}`,
      );
      doc
        .fillColor('#059669')
        .text(
          `Total Collected: ${this.formatCurrency(report.totals.totalCollected)}`,
        );
      doc
        .fillColor('#dc2626')
        .text(
          `Total Outstanding: ${this.formatCurrency(report.totals.totalOutstanding)}`,
        );
      doc.moveDown(2);

      // Customer List
      doc.fontSize(16).fillColor('#1f2937').text('Customer Details');
      doc.moveDown(0.5);

      report.customers.forEach((customer) => {
        doc.fontSize(11).fillColor('#1f2937').text(customer.companyName);
        doc
          .fontSize(9)
          .fillColor('#6b7280')
          .text(
            `Email: ${customer.email} | Invoices: ${customer.invoiceCount} | Invoiced: ${this.formatCurrency(customer.totalInvoiced)} | Paid: ${this.formatCurrency(customer.totalPaid)} | Outstanding: ${this.formatCurrency(customer.outstanding)}${customer.overdueInvoices > 0 ? ` | Overdue: ${customer.overdueInvoices}` : ''}`,
          );
        doc.moveDown(0.5);
      });

      // Footer
      doc.fontSize(10).fillColor('#6b7280');
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 50, 700, {
        align: 'center',
        width: 500,
      });

      doc.end();
    });
  }

  async generateTaxPdf(userId: string, year: number): Promise<Buffer> {
    const report = await this.getTaxReport(userId, year);

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
        .text('Tax Report', { align: 'center' });
      doc
        .fontSize(14)
        .fillColor('#6b7280')
        .text(`Year: ${year}`, { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(16).fillColor('#1f2937').text('Summary');
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor('#4f46e5')
        .text(
          `Total Tax Collected: ${this.formatCurrency(report.totals.totalTaxCollected)}`,
        );
      doc
        .fillColor('#1f2937')
        .text(
          `Total Taxable Amount: ${this.formatCurrency(report.totals.totalTaxableAmount)}`,
        );
      doc.text(`Taxed Invoices: ${report.totals.invoiceCount}`);
      doc.moveDown(2);

      // Monthly Tax
      doc.fontSize(16).fillColor('#1f2937').text('Monthly Tax Collected');
      doc.moveDown(0.5);

      report.monthlyTax.forEach((month) => {
        doc
          .fontSize(10)
          .fillColor('#1f2937')
          .text(`${month.month}: ${this.formatCurrency(month.taxAmount)}`);
      });

      doc.moveDown(2);

      // By Tax Type
      doc.fontSize(16).fillColor('#1f2937').text('Tax by Type');
      doc.moveDown(0.5);

      report.taxByType.forEach((tax) => {
        doc
          .fontSize(10)
          .fillColor('#1f2937')
          .text(
            `${tax.taxName} (${tax.taxRate}%) - ${this.formatCurrency(tax.taxAmount)} from ${tax.invoiceCount} invoices`,
          );
      });

      // Footer
      doc.fontSize(10).fillColor('#6b7280');
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 50, 700, {
        align: 'center',
        width: 500,
      });

      doc.end();
    });
  }

  async generatePaymentsPdf(userId: string, year: number): Promise<Buffer> {
    const report = await this.getPaymentReport(userId, year);

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
        .text('Payment Report', { align: 'center' });
      doc
        .fontSize(14)
        .fillColor('#6b7280')
        .text(`Year: ${year}`, { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(16).fillColor('#1f2937').text('Summary');
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor('#059669')
        .text(
          `Total Payments: ${this.formatCurrency(report.totals.totalPayments)}`,
        );
      doc
        .fillColor('#1f2937')
        .text(`Payment Count: ${report.totals.paymentCount}`);
      doc.text(
        `Average Payment: ${this.formatCurrency(report.totals.averagePayment)}`,
      );
      doc.moveDown(2);

      // Monthly Payments
      doc.fontSize(16).fillColor('#1f2937').text('Monthly Payments');
      doc.moveDown(0.5);

      report.monthlyPayments.forEach((month) => {
        doc
          .fontSize(10)
          .fillColor('#1f2937')
          .text(`${month.month}: ${this.formatCurrency(month.amount)}`);
      });

      doc.moveDown(2);

      // By Payment Method
      doc.fontSize(16).fillColor('#1f2937').text('Payments by Method');
      doc.moveDown(0.5);

      report.paymentsByMethod.forEach((method) => {
        doc
          .fontSize(10)
          .fillColor('#1f2937')
          .text(
            `${method.method.replace(/_/g, ' ')} - ${this.formatCurrency(method.amount)} (${method.count} payments)`,
          );
      });

      // Footer
      doc.fontSize(10).fillColor('#6b7280');
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 50, 700, {
        align: 'center',
        width: 500,
      });

      doc.end();
    });
  }
}

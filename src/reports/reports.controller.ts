import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

interface AuthRequest {
  user: { id: string };
}

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('profit-loss')
  getProfitLoss(@Request() req: AuthRequest, @Query('year') year?: string) {
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    return this.reportsService.getProfitLossReport(req.user.id, reportYear);
  }

  @Get('profit-loss/pdf')
  async getProfitLossPdf(
    @Request() req: AuthRequest,
    @Query('year') year: string,
    @Res() res: Response,
  ) {
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    const pdfBuffer = await this.reportsService.generateProfitLossPdf(
      req.user.id,
      reportYear,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="profit-loss-report-${reportYear}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get('sales')
  getSales(@Request() req: AuthRequest, @Query('year') year?: string) {
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    return this.reportsService.getSalesReport(req.user.id, reportYear);
  }

  @Get('sales/pdf')
  async getSalesPdf(
    @Request() req: AuthRequest,
    @Query('year') year: string,
    @Res() res: Response,
  ) {
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    const pdfBuffer = await this.reportsService.generateSalesPdf(
      req.user.id,
      reportYear,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sales-report-${reportYear}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get('expenses')
  getExpenses(@Request() req: AuthRequest, @Query('year') year?: string) {
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    return this.reportsService.getExpenseReport(req.user.id, reportYear);
  }

  @Get('expenses/pdf')
  async getExpensesPdf(
    @Request() req: AuthRequest,
    @Query('year') year: string,
    @Res() res: Response,
  ) {
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    const pdfBuffer = await this.reportsService.generateExpensesPdf(
      req.user.id,
      reportYear,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="expense-report-${reportYear}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get('customers')
  getCustomers(@Request() req: AuthRequest) {
    return this.reportsService.getCustomerReport(req.user.id);
  }

  @Get('customers/pdf')
  async getCustomersPdf(@Request() req: AuthRequest, @Res() res: Response) {
    const pdfBuffer = await this.reportsService.generateCustomersPdf(
      req.user.id,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="customer-report.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get('tax')
  getTax(@Request() req: AuthRequest, @Query('year') year?: string) {
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    return this.reportsService.getTaxReport(req.user.id, reportYear);
  }

  @Get('tax/pdf')
  async getTaxPdf(
    @Request() req: AuthRequest,
    @Query('year') year: string,
    @Res() res: Response,
  ) {
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    const pdfBuffer = await this.reportsService.generateTaxPdf(
      req.user.id,
      reportYear,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tax-report-${reportYear}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get('payments')
  getPayments(@Request() req: AuthRequest, @Query('year') year?: string) {
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    return this.reportsService.getPaymentReport(req.user.id, reportYear);
  }

  @Get('payments/pdf')
  async getPaymentsPdf(
    @Request() req: AuthRequest,
    @Query('year') year: string,
    @Res() res: Response,
  ) {
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    const pdfBuffer = await this.reportsService.generatePaymentsPdf(
      req.user.id,
      reportYear,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payment-report-${reportYear}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}

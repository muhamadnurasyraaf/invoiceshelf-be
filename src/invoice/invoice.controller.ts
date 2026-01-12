import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Patch,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InvoiceService } from './invoice.service';
import { EmailService } from '../email/email.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  UpdateInvoiceDto,
  InvoiceStatus,
  PaymentStatus,
} from './dto/update-invoice.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('invoices')
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: AuthRequest, @Body() dto: CreateInvoiceDto) {
    const invoice = await this.invoiceService.create(req.user.id, dto);

    // Send invoice email and set status to SENT
    await this.emailService.sendInvoiceEmailDirect(invoice.id);

    return invoice;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req: AuthRequest) {
    return this.invoiceService.findAll(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.invoiceService.findOne(id, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoiceService.update(id, req.user.id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body('status') status: InvoiceStatus,
  ) {
    return this.invoiceService.updateStatus(id, req.user.id, status);
  }

  @Patch(':id/payment-status')
  @UseGuards(JwtAuthGuard)
  updatePaymentStatus(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body('paymentStatus') paymentStatus: PaymentStatus,
  ) {
    return this.invoiceService.updatePaymentStatus(
      id,
      req.user.id,
      paymentStatus,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.invoiceService.remove(id, req.user.id);
  }

  // Public endpoint - no auth required for PDF download from email links
  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.invoiceService.generatePdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}

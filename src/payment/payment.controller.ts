import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Request,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(@Request() req, @Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(req.user.id, createPaymentDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.paymentService.findAll(req.user.id);
  }

  @Get('summary')
  getSummary(@Request() req) {
    return this.paymentService.getPaymentSummary(req.user.id);
  }

  @Get('invoice/:invoiceId')
  findByInvoice(@Request() req, @Param('invoiceId') invoiceId: string) {
    return this.paymentService.findByInvoice(req.user.id, invoiceId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.paymentService.findOne(req.user.id, id);
  }

  @Get(':id/receipt')
  async downloadReceipt(
    @Request() req,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdfBuffer = await this.paymentService.generateReceipt(
      req.user.id,
      id,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${id.slice(-8)}.pdf"`,
    });

    return new StreamableFile(pdfBuffer);
  }

  @Put(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentService.update(req.user.id, id, updatePaymentDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.paymentService.remove(req.user.id, id);
  }
}

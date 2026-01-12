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
} from '@nestjs/common';
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

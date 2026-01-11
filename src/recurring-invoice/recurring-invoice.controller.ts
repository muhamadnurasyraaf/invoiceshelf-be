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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecurringInvoiceService } from './recurring-invoice.service';
import { CreateRecurringInvoiceDto } from './dto/create-recurring-invoice.dto';
import {
  UpdateRecurringInvoiceDto,
  RecurringInvoiceStatus,
} from './dto/update-recurring-invoice.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('recurring-invoices')
@UseGuards(JwtAuthGuard)
export class RecurringInvoiceController {
  constructor(
    private readonly recurringInvoiceService: RecurringInvoiceService,
  ) {}

  @Post()
  create(@Request() req: AuthRequest, @Body() dto: CreateRecurringInvoiceDto) {
    return this.recurringInvoiceService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.recurringInvoiceService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.recurringInvoiceService.findOne(id, req.user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() dto: UpdateRecurringInvoiceDto,
  ) {
    return this.recurringInvoiceService.update(id, req.user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body('status') status: RecurringInvoiceStatus,
  ) {
    return this.recurringInvoiceService.updateStatus(id, req.user.id, status);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.recurringInvoiceService.remove(id, req.user.id);
  }
}

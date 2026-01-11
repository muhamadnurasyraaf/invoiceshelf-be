import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
@UseGuards(JwtAuthGuard)
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('trigger-recurring')
  async triggerRecurringInvoices() {
    await this.schedulerService.triggerNow();
    return { message: 'Recurring invoice generation triggered' };
  }
}

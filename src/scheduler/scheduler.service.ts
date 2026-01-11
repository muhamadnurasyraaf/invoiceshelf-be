import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue('recurring-invoices') private recurringInvoicesQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.setupRecurringJobs();
  }

  private async setupRecurringJobs() {
    // Remove existing repeatable jobs to avoid duplicates
    const existingJobs = await this.recurringInvoicesQueue.getRepeatableJobs();
    for (const job of existingJobs) {
      await this.recurringInvoicesQueue.removeRepeatableByKey(job.key);
    }

    // Add a repeatable job that runs every hour to check for due invoices
    await this.recurringInvoicesQueue.add(
      'generate-invoices',
      {},
      {
        repeat: {
          pattern: '0 * * * *', // Every hour at minute 0
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log('Recurring invoice scheduler initialized - runs every hour');
  }

  // Manual trigger for testing
  async triggerNow() {
    await this.recurringInvoicesQueue.add('generate-invoices', {}, {
      removeOnComplete: true,
    });
    this.logger.log('Manual invoice generation triggered');
  }
}

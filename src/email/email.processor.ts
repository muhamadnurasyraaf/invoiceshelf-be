import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from './email.service';

export interface SendInvoiceEmailJob {
  invoiceId: string;
  userId?: string;
  subject?: string;
  customMessage?: string;
  autoSend?: boolean;
}

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private emailService: EmailService) {
    super();
  }

  async process(job: Job<SendInvoiceEmailJob>): Promise<void> {
    this.logger.log(`Processing email job ${job.id}: ${job.name}`);

    switch (job.name) {
      case 'send-invoice':
        await this.handleSendInvoice(job.data);
        break;
      case 'send-invoice-auto':
        await this.handleAutoSendInvoice(job.data);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleSendInvoice(data: SendInvoiceEmailJob): Promise<void> {
    try {
      if (data.userId) {
        await this.emailService.sendInvoiceEmail(
          data.invoiceId,
          data.userId,
          data.subject,
          data.customMessage,
        );
      }
      this.logger.log(`Invoice email sent for invoice: ${data.invoiceId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send invoice email for ${data.invoiceId}: ${error.message}`,
      );
      throw error;
    }
  }

  private async handleAutoSendInvoice(data: SendInvoiceEmailJob): Promise<void> {
    try {
      await this.emailService.sendInvoiceEmailDirect(data.invoiceId);
      this.logger.log(`Auto invoice email sent for invoice: ${data.invoiceId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send auto invoice email for ${data.invoiceId}: ${error.message}`,
      );
      throw error;
    }
  }
}

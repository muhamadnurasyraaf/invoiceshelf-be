import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailService } from './email.service';
import {
  SendInvoiceEmailDto,
  PreviewInvoiceEmailDto,
} from './dto/send-invoice-email.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  @Post('invoice/preview')
  async previewInvoiceEmail(
    @Request() req: AuthRequest,
    @Body() dto: PreviewInvoiceEmailDto,
  ) {
    return this.emailService.getInvoiceEmailPreview(
      dto.invoiceId,
      req.user.id,
      dto.subject,
      dto.customMessage,
    );
  }

  @Post('invoice/send')
  async sendInvoiceEmail(
    @Request() req: AuthRequest,
    @Body() dto: SendInvoiceEmailDto,
  ) {
    // Add to queue for background processing
    await this.emailQueue.add(
      'send-invoice',
      {
        invoiceId: dto.invoiceId,
        userId: req.user.id,
        subject: dto.subject,
        customMessage: dto.customMessage,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    return {
      success: true,
      message: 'Invoice email queued for sending',
    };
  }
}

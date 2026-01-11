import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringInvoiceService } from './recurring-invoice.service';

@Processor('recurring-invoices')
export class RecurringInvoiceProcessor extends WorkerHost {
  private readonly logger = new Logger(RecurringInvoiceProcessor.name);

  constructor(
    private prisma: PrismaService,
    private recurringInvoiceService: RecurringInvoiceService,
    @InjectQueue('email') private emailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.id}: ${job.name}`);

    switch (job.name) {
      case 'generate-invoices':
        await this.generateDueInvoices();
        break;
      case 'generate-single':
        await this.generateSingleInvoice(job.data.recurringInvoiceId);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async generateDueInvoices(): Promise<void> {
    this.logger.log('Checking for recurring invoices due for generation...');

    const dueInvoices =
      await this.recurringInvoiceService.findDueForGeneration();

    this.logger.log(
      `Found ${dueInvoices.length} recurring invoices to process`,
    );

    for (const recurring of dueInvoices) {
      try {
        await this.generateInvoiceFromRecurring(recurring);
        await this.recurringInvoiceService.markAsGenerated(recurring.id);
        this.logger.log(
          `Generated invoice for recurring invoice: ${recurring.name} (${recurring.id})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate invoice for recurring: ${recurring.id}`,
          error,
        );
      }
    }
  }

  private async generateSingleInvoice(
    recurringInvoiceId: string,
  ): Promise<void> {
    const recurring = await this.prisma.recurringInvoice.findUnique({
      where: { id: recurringInvoiceId },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        customer: true,
      },
    });

    if (!recurring) {
      this.logger.warn(`Recurring invoice not found: ${recurringInvoiceId}`);
      return;
    }

    await this.generateInvoiceFromRecurring(recurring);
    await this.recurringInvoiceService.markAsGenerated(recurring.id);
  }

  private async generateInvoiceFromRecurring(recurring: any): Promise<void> {
    // Calculate due date based on dueAfterDays
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + recurring.dueAfterDays);

    // Calculate amount from items
    const amountDue = recurring.items.reduce(
      (total: number, item: any) => total + item.item.price * item.quantity,
      0,
    );

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

    // Create the invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        number: invoiceNumber,
        status: 'DRAFT',
        dueDate,
        amountDue,
        notes: recurring.notes,
        userId: recurring.userId,
        customerId: recurring.customerId,
        items: {
          create: recurring.items.map((item: any) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        },
      },
    });

    // Queue email to be sent automatically
    await this.emailQueue.add(
      'send-invoice-auto',
      {
        invoiceId: invoice.id,
        autoSend: true,
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

    this.logger.log(
      `Invoice ${invoiceNumber} created and queued for email sending`,
    );
  }
}

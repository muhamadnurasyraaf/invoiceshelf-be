import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RecurringInvoiceService } from './recurring-invoice.service';
import { RecurringInvoiceController } from './recurring-invoice.controller';
import { RecurringInvoiceProcessor } from './recurring-invoice.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'recurring-invoices',
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [RecurringInvoiceController],
  providers: [RecurringInvoiceService, RecurringInvoiceProcessor],
  exports: [RecurringInvoiceService],
})
export class RecurringInvoiceModule {}

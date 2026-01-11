import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth';
import { UserModule } from './user';
import { CustomerModule } from './customer';
import { ItemModule } from './item/item.module';
import { EstimateModule } from './estimate';
import { InvoiceModule } from './invoice';
import { RecurringInvoiceModule } from './recurring-invoice';
import { SchedulerModule } from './scheduler/scheduler.module';
import { EmailModule } from './email';
import { PaymentModule } from './payment';
import { ExpenseModule } from './expense';
import { DashboardModule } from './dashboard';
import { TaxModule } from './tax';
import { PortalModule } from './portal/portal.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    CustomerModule,
    ItemModule,
    EstimateModule,
    InvoiceModule,
    RecurringInvoiceModule,
    SchedulerModule,
    EmailModule,
    PaymentModule,
    ExpenseModule,
    DashboardModule,
    TaxModule,
    PortalModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

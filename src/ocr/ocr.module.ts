import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { CustomerModule } from '../customer/customer.module';
import { ItemModule } from '../item/item.module';

@Module({
  imports: [CustomerModule, ItemModule],
  controllers: [OcrController],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}

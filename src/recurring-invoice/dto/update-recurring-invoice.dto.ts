import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  RecurringInvoiceItemDto,
  RecurringFrequency,
} from './create-recurring-invoice.dto';

export enum RecurringInvoiceStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export class UpdateRecurringInvoiceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsEnum(RecurringFrequency)
  @IsOptional()
  frequency?: RecurringFrequency;

  @IsEnum(RecurringInvoiceStatus)
  @IsOptional()
  status?: RecurringInvoiceStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @Min(1)
  @Max(31)
  @IsOptional()
  dayOfMonth?: number;

  @IsNumber()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  dueAfterDays?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringInvoiceItemDto)
  @IsOptional()
  items?: RecurringInvoiceItemDto[];
}

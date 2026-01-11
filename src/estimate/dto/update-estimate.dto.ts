import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstimateItemDto } from './create-estimate.dto';

export enum EstimateStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export class UpdateEstimateDto {
  @IsString()
  @IsOptional()
  number?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(EstimateStatus)
  @IsOptional()
  status?: EstimateStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimateItemDto)
  @IsOptional()
  items?: EstimateItemDto[];
}

import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';

export enum ExpenseCategory {
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  SALARIES = 'SALARIES',
  SUPPLIES = 'SUPPLIES',
  EQUIPMENT = 'EQUIPMENT',
  MARKETING = 'MARKETING',
  TRAVEL = 'TRAVEL',
  INSURANCE = 'INSURANCE',
  TAXES = 'TAXES',
  SOFTWARE = 'SOFTWARE',
  MAINTENANCE = 'MAINTENANCE',
  PROFESSIONAL_SERVICES = 'PROFESSIONAL_SERVICES',
  OTHER = 'OTHER',
}

export class CreateExpenseDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receipt?: string;
}

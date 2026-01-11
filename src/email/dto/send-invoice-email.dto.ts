import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SendInvoiceEmailDto {
  @IsString()
  @IsNotEmpty()
  invoiceId: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  customMessage?: string;
}

export class PreviewInvoiceEmailDto {
  @IsString()
  @IsNotEmpty()
  invoiceId: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  customMessage?: string;
}

import { IsString, IsNotEmpty } from 'class-validator';

export class OcrInvoiceDto {
  @IsString()
  @IsNotEmpty()
  image: string; // Base64 encoded image

  @IsString()
  @IsNotEmpty()
  mimeType: string; // e.g., 'image/png', 'image/jpeg'
}

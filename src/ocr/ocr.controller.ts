import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OcrService } from './ocr.service';
import { OcrInvoiceDto } from './dto/ocr-invoice.dto';

@Controller('ocr')
export class OcrController {
  private readonly logger = new Logger(OcrController.name);

  constructor(private readonly ocrService: OcrService) {}

  @Post('invoice')
  @UseGuards(JwtAuthGuard)
  async extractInvoice(@Body() dto: OcrInvoiceDto) {
    this.logger.log('Received OCR invoice extraction request');
    this.logger.log(`MIME type: ${dto.mimeType}`);
    this.logger.log(`Image data length: ${dto.image.length}`);

    try {
      const extractedData = await this.ocrService.extractInvoiceFromImage(
        dto.image,
        dto.mimeType,
      );

      this.logger.log('Invoice extraction completed successfully');
      return extractedData;
    } catch (error) {
      this.logger.error('OCR extraction failed:', error);
      throw new HttpException(
        {
          message: 'Failed to extract invoice data from image',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('invoice/process')
  @UseGuards(JwtAuthGuard)
  async extractAndProcessInvoice(@Request() req, @Body() dto: OcrInvoiceDto) {
    this.logger.log('Received OCR invoice extraction and processing request');
    this.logger.log(`MIME type: ${dto.mimeType}`);
    this.logger.log(`Image data length: ${dto.image.length}`);
    this.logger.log(`User ID: ${req.user.id}`);

    try {
      const processedData = await this.ocrService.extractAndProcessInvoice(
        dto.image,
        dto.mimeType,
        req.user.id,
      );

      this.logger.log(
        'Invoice extraction and processing completed successfully',
      );
      return processedData;
    } catch (error) {
      this.logger.error('OCR extraction and processing failed:', error);
      throw new HttpException(
        {
          message: 'Failed to extract and process invoice data from image',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CustomerService } from '../customer/customer.service';
import { ItemService } from '../item/item.service';

export interface ExtractedInvoiceData {
  invoiceNumber?: string;
  vendorName?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorAddress?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  invoiceDate?: string;
  dueDate?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  total?: number;
  notes?: string;
  currency?: string;
}

export interface ProcessedInvoiceData extends ExtractedInvoiceData {
  customer?: {
    id: string;
    companyName: string;
    email: string;
    phone: string;
    isNew: boolean;
  };
  processedItems: Array<{
    itemId: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    isNew: boolean;
  }>;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(
    private readonly customerService: CustomerService,
    private readonly itemService: ItemService,
  ) {}

  private getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      const apiKey = process.env.GEMINI_API_KEY;
      this.logger.log(`GEMINI_API_KEY present: ${!!apiKey}`);
      if (!apiKey) {
        this.logger.error('GEMINI_API_KEY is not set in environment variables');
        throw new Error('GEMINI_API_KEY is required');
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI;
  }

  async extractInvoiceFromImage(
    imageBase64: string,
    mimeType: string,
  ): Promise<ExtractedInvoiceData> {
    this.logger.log('Starting invoice extraction from image');
    this.logger.debug(`Image MIME type: ${mimeType}`);
    this.logger.debug(`Image base64 length: ${imageBase64.length}`);

    try {
      const genAI = this.getGenAI();
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const prompt = `You are an OCR specialist. Analyze this invoice image and extract all the information into a structured JSON format.

Extract the following information if present:
- invoiceNumber: The invoice number/ID
- vendorName: The company/person issuing the invoice
- vendorEmail: Vendor's email
- vendorPhone: Vendor's phone number
- vendorAddress: Vendor's address
- customerName: The customer/client name
- customerEmail: Customer's email
- customerPhone: Customer's phone number
- customerAddress: Customer's address
- invoiceDate: The invoice date (in ISO format YYYY-MM-DD)
- dueDate: The payment due date (in ISO format YYYY-MM-DD)
- items: Array of line items, each with:
  - description: Item description
  - quantity: Number of units
  - unitPrice: Price per unit
  - total: Total for this line item
- subtotal: Sum before tax
- taxRate: Tax percentage (if applicable)
- taxAmount: Tax amount
- total: Final total amount
- notes: Any additional notes
- currency: Currency code (e.g., MYR, USD, EUR)

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting or code blocks
- Use null for any fields that cannot be found in the image
- For items array, return an empty array [] if no items found
- Ensure all numbers are actual numbers, not strings
- Dates should be in YYYY-MM-DD format

Example response format:
{
  "invoiceNumber": "INV-001",
  "vendorName": "ABC Company",
  "items": [{"description": "Service", "quantity": 1, "unitPrice": 100, "total": 100}],
  "total": 100
}`;

      this.logger.log('Sending request to Gemini API...');

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: imageBase64,
          },
        },
        { text: prompt },
      ]);

      const response = result.response;
      const text = response.text();

      this.logger.log('=== GEMINI API RESPONSE START ===');
      this.logger.log(text);
      this.logger.log('=== GEMINI API RESPONSE END ===');

      // Parse the JSON response
      let extractedData: ExtractedInvoiceData;
      try {
        // Clean the response - remove markdown code blocks if present
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.slice(7);
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.slice(3);
        }
        if (cleanedText.endsWith('```')) {
          cleanedText = cleanedText.slice(0, -3);
        }
        cleanedText = cleanedText.trim();

        this.logger.debug('Cleaned JSON text:', cleanedText);
        extractedData = JSON.parse(cleanedText);
      } catch (parseError) {
        this.logger.error(
          'Failed to parse Gemini response as JSON:',
          parseError,
        );
        this.logger.error('Raw response:', text);
        throw new Error('Failed to parse invoice data from image');
      }

      // Ensure items array exists
      if (!extractedData.items) {
        extractedData.items = [];
      }

      this.logger.log('Successfully extracted invoice data');
      this.logger.debug(
        'Extracted data:',
        JSON.stringify(extractedData, null, 2),
      );

      return extractedData;
    } catch (error) {
      this.logger.error('Error extracting invoice from image:', error);
      throw error;
    }
  }

  async extractAndProcessInvoice(
    imageBase64: string,
    mimeType: string,
    userId: string,
  ): Promise<ProcessedInvoiceData> {
    // First extract the raw data from the image
    const extractedData = await this.extractInvoiceFromImage(
      imageBase64,
      mimeType,
    );

    this.logger.log('Processing extracted invoice data for user:', userId);

    // Process customer - check if exists or create new
    let customerResult: ProcessedInvoiceData['customer'] = undefined;

    if (extractedData.customerName || extractedData.customerEmail) {
      const { customer, created } = await this.customerService.findOrCreate(
        userId,
        {
          companyName: extractedData.customerName,
          email: extractedData.customerEmail,
          phone: extractedData.customerPhone,
          shippingAddress: extractedData.customerAddress,
        },
      );

      if (customer) {
        customerResult = {
          id: customer.id,
          companyName: customer.companyName,
          email: customer.email,
          phone: customer.phone,
          isNew: created,
        };
        this.logger.log(
          `Customer ${created ? 'created' : 'found'}: ${customer.companyName}`,
        );
      }
    }

    // Process items - check if exists or create new
    const processedItems: ProcessedInvoiceData['processedItems'] = [];

    if (extractedData.items && extractedData.items.length > 0) {
      const itemResults = await this.itemService.findOrCreateMany(
        userId,
        extractedData.items,
      );

      for (const result of itemResults) {
        processedItems.push({
          itemId: result.item.id,
          name: result.item.name,
          price: result.item.price,
          quantity: result.quantity,
          total: result.total,
          isNew: result.created,
        });
        this.logger.log(
          `Item ${result.created ? 'created' : 'found'}: ${result.item.name}`,
        );
      }
    }

    this.logger.log(
      `Processed ${processedItems.length} items, customer: ${customerResult ? customerResult.companyName : 'none'}`,
    );

    return {
      ...extractedData,
      customer: customerResult,
      processedItems,
    };
  }
}

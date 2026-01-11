import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface InvoiceEmailData {
  invoiceId: string;
  subject?: string;
  customMessage?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private invoiceTemplate: handlebars.TemplateDelegate;

  constructor(private prisma: PrismaService) {
    this.initializeTransporter();
    this.loadTemplates();
  }

  private initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.MAIL_PORT || process.env.SMTP_PORT || '587'),
      secure:
        (process.env.MAIL_ENCRYPTION || process.env.SMTP_SECURE) === 'ssl',
      auth: {
        user: process.env.MAIL_USERNAME || process.env.SMTP_USER,
        pass: process.env.MAIL_PASSWORD || process.env.SMTP_PASS,
      },
    });
  }

  private loadTemplates() {
    try {
      const templatePath = path.join(__dirname, 'templates', 'invoice.hbs');
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      this.invoiceTemplate = handlebars.compile(templateSource);
    } catch (error) {
      this.logger.warn('Could not load email template, using fallback');
      this.invoiceTemplate = handlebars.compile(this.getFallbackTemplate());
    }
  }

  private getFallbackTemplate(): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>New Invoice - {{invoiceNumber}}</h1>
          <p>Dear {{customerName}},</p>
          <p>You have received a new invoice from {{senderName}}.</p>
          {{#if customMessage}}<p>{{customMessage}}</p>{{/if}}
          <p><strong>Amount Due:</strong> {{totalAmount}}</p>
          <p><strong>Due Date:</strong> {{dueDate}}</p>
          <p><a href="{{invoiceUrl}}">View Invoice</a> | <a href="{{downloadUrl}}">Download PDF</a></p>
          <p>Thank you for your business!</p>
        </body>
      </html>
    `;
  }

  private getBaseUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  private getApiUrl(): string {
    return process.env.API_URL || 'http://localhost:3001';
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  async getInvoiceEmailPreview(
    invoiceId: string,
    userId: string,
    subject?: string,
    customMessage?: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
        user: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const baseUrl = this.getBaseUrl();
    const apiUrl = this.getApiUrl();

    const templateData = {
      invoiceNumber: invoice.number,
      customerName: invoice.customer.companyName,
      customerEmail: invoice.customer.email,
      invoiceDate: this.formatDate(invoice.createdAt),
      dueDate: this.formatDate(invoice.dueDate),
      customMessage,
      totalAmount: this.formatCurrency(invoice.amountDue),
      notes: invoice.notes,
      senderName: invoice.user.username,
      invoiceUrl: `${baseUrl}/portal/invoices/${invoice.id}`,
      downloadUrl: `${apiUrl}/invoices/${invoice.id}/pdf`,
    };

    const html = this.invoiceTemplate(templateData);
    const defaultSubject = `Invoice ${invoice.number} from ${invoice.user.username}`;

    return {
      to: invoice.customer.email,
      subject: subject || defaultSubject,
      html,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        customerName: invoice.customer.companyName,
        customerEmail: invoice.customer.email,
        amountDue: invoice.amountDue,
        dueDate: invoice.dueDate,
      },
    };
  }

  async sendInvoiceEmail(
    invoiceId: string,
    userId: string,
    subject?: string,
    customMessage?: string,
  ) {
    const preview = await this.getInvoiceEmailPreview(
      invoiceId,
      userId,
      subject,
      customMessage,
    );

    try {
      await this.transporter.sendMail({
        from:
          process.env.MAIL_FROM ||
          process.env.MAIL_USERNAME ||
          process.env.SMTP_USER,
        to: preview.to,
        subject: preview.subject,
        html: preview.html,
      });

      // Update invoice status to SENT
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'SENT' },
      });

      this.logger.log(`Invoice email sent successfully to ${preview.to}`);

      return {
        success: true,
        message: `Invoice sent to ${preview.to}`,
        to: preview.to,
        subject: preview.subject,
      };
    } catch (error) {
      this.logger.error(`Failed to send invoice email: ${error.message}`);
      throw error;
    }
  }

  // For recurring invoices - auto send
  async sendInvoiceEmailDirect(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
        user: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const baseUrl = this.getBaseUrl();
    const apiUrl = this.getApiUrl();

    const templateData = {
      invoiceNumber: invoice.number,
      customerName: invoice.customer.companyName,
      customerEmail: invoice.customer.email,
      invoiceDate: this.formatDate(invoice.createdAt),
      dueDate: this.formatDate(invoice.dueDate),
      customMessage: 'This is an automatically generated invoice.',
      totalAmount: this.formatCurrency(invoice.amountDue),
      notes: invoice.notes,
      senderName: invoice.user.username,
      invoiceUrl: `${baseUrl}/portal/invoices/${invoice.id}`,
      downloadUrl: `${apiUrl}/invoices/${invoice.id}/pdf`,
    };

    const html = this.invoiceTemplate(templateData);
    const subject = `Invoice ${invoice.number} from ${invoice.user.username}`;

    try {
      await this.transporter.sendMail({
        from:
          process.env.MAIL_FROM ||
          process.env.MAIL_USERNAME ||
          process.env.SMTP_USER,
        to: invoice.customer.email,
        subject,
        html,
      });

      // Update invoice status to SENT
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'SENT' },
      });

      this.logger.log(
        `Auto invoice email sent successfully to ${invoice.customer.email}`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send auto invoice email: ${error.message}`);
      throw error;
    }
  }
}

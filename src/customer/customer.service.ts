import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.customer.findMany({
      where: { userId },
      select: {
        id: true,
        companyName: true,
        contactPersonName: true,
        email: true,
        phone: true,
        shippingAddress: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, userId },
      select: {
        id: true,
        companyName: true,
        contactPersonName: true,
        email: true,
        phone: true,
        shippingAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async create(userId: string, dto: CreateCustomerDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    return this.prisma.customer.create({
      data: {
        companyName: dto.companyName,
        contactPersonName: dto.contactPersonName,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        shippingAddress: dto.shippingAddress,
        userId,
      },
      select: {
        id: true,
        companyName: true,
        contactPersonName: true,
        email: true,
        phone: true,
        shippingAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, userId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updateData: Partial<UpdateCustomerDto> = { ...dto };
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 12);
    }

    return this.prisma.customer.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        companyName: true,
        contactPersonName: true,
        email: true,
        phone: true,
        shippingAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(id: string, userId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, userId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.prisma.customer.delete({
      where: { id },
    });

    return { message: 'Customer deleted successfully' };
  }

  async count(userId: string) {
    return this.prisma.customer.count({
      where: { userId },
    });
  }

  async findByEmailOrName(
    userId: string,
    email?: string,
    companyName?: string,
  ) {
    if (!email && !companyName) {
      return null;
    }

    const conditions: Prisma.CustomerWhereInput[] = [];
    if (email) {
      conditions.push({
        email: { equals: email, mode: 'insensitive' },
      });
    }
    if (companyName) {
      conditions.push({
        companyName: { equals: companyName, mode: 'insensitive' },
      });
    }

    return this.prisma.customer.findFirst({
      where: {
        userId,
        OR: conditions,
      },
      select: {
        id: true,
        companyName: true,
        contactPersonName: true,
        email: true,
        phone: true,
        shippingAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOrCreate(
    userId: string,
    data: {
      companyName?: string;
      contactPersonName?: string;
      email?: string;
      phone?: string;
      shippingAddress?: string;
    },
  ) {
    // Try to find existing customer by email or company name
    const existingCustomer = await this.findByEmailOrName(
      userId,
      data.email,
      data.companyName,
    );

    if (existingCustomer) {
      this.logger.log(`Found existing customer: ${existingCustomer.id}`);
      return { customer: existingCustomer, created: false };
    }

    // Create new customer if we have enough data
    if (!data.companyName || !data.email || !data.phone) {
      this.logger.warn('Insufficient data to create customer');
      return { customer: null, created: false };
    }

    // Generate a random password for the new customer
    const randomPassword = Math.random().toString(36).slice(-12);
    const hashedPassword = await bcrypt.hash(randomPassword, 12);

    const newCustomer = await this.prisma.customer.create({
      data: {
        companyName: data.companyName,
        contactPersonName: data.contactPersonName,
        email: data.email,
        password: hashedPassword,
        phone: data.phone,
        shippingAddress: data.shippingAddress,
        userId,
      },
      select: {
        id: true,
        companyName: true,
        contactPersonName: true,
        email: true,
        phone: true,
        shippingAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Created new customer: ${newCustomer.id}`);
    return { customer: newCustomer, created: true };
  }
}

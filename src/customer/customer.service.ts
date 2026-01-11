import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Injectable()
export class CustomerService {
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
}

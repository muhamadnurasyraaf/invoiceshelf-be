import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxDto, UpdateTaxDto } from './dto';

@Injectable()
export class TaxService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createTaxDto: CreateTaxDto) {
    const { name, rate, description, isDefault } = createTaxDto;

    // If this tax is set as default, unset other defaults
    if (isDefault) {
      await this.prisma.tax.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.tax.create({
      data: {
        name,
        rate,
        description,
        isDefault: isDefault || false,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.tax.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const tax = await this.prisma.tax.findFirst({
      where: { id, userId },
    });

    if (!tax) {
      throw new NotFoundException('Tax not found');
    }

    return tax;
  }

  async update(userId: string, id: string, updateTaxDto: UpdateTaxDto) {
    await this.findOne(userId, id);

    const { name, rate, description, isDefault } = updateTaxDto;

    // If this tax is set as default, unset other defaults
    if (isDefault) {
      await this.prisma.tax.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.tax.update({
      where: { id },
      data: {
        name,
        rate,
        description,
        isDefault,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.tax.delete({
      where: { id },
    });
  }

  async getDefault(userId: string) {
    return this.prisma.tax.findFirst({
      where: { userId, isDefault: true },
    });
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemService {
  private readonly logger = new Logger(ItemService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateItemDto) {
    return this.prisma.item.create({
      data: {
        name: dto.name,
        price: dto.price || 0,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.item.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  async update(id: string, userId: string, dto: UpdateItemDto) {
    await this.findOne(id, userId);

    return this.prisma.item.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.item.delete({
      where: { id },
    });
  }

  async findByName(userId: string, name: string) {
    if (!name) {
      return null;
    }

    return this.prisma.item.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }

  async findOrCreate(
    userId: string,
    data: {
      name: string;
      price?: number;
    },
  ) {
    // Try to find existing item by name
    const existingItem = await this.findByName(userId, data.name);

    if (existingItem) {
      this.logger.log(
        `Found existing item: ${existingItem.id} - ${existingItem.name}`,
      );
      return { item: existingItem, created: false };
    }

    // Create new item
    const newItem = await this.prisma.item.create({
      data: {
        name: data.name,
        price: data.price || 0,
        userId,
      },
    });

    this.logger.log(`Created new item: ${newItem.id} - ${newItem.name}`);
    return { item: newItem, created: true };
  }

  async findOrCreateMany(
    userId: string,
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>,
  ) {
    const results: Array<{
      item: { id: string; name: string; price: number };
      created: boolean;
      quantity: number;
      unitPrice: number;
      total: number;
    }> = [];

    for (const itemData of items) {
      const { item, created } = await this.findOrCreate(userId, {
        name: itemData.description,
        price: itemData.unitPrice,
      });

      results.push({
        item,
        created,
        quantity: itemData.quantity,
        unitPrice: itemData.unitPrice,
        total: itemData.total,
      });
    }

    return results;
  }
}

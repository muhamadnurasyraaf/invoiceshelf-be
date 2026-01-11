import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemService {
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
}

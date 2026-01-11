import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ItemService } from './item.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateItemDto) {
    return this.itemService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.itemService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.itemService.findOne(id, req.user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Request() req, @Body() dto: UpdateItemDto) {
    return this.itemService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.itemService.remove(id, req.user.id);
  }
}

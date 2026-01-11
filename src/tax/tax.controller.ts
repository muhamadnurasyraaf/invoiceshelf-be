import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TaxService } from './tax.service';
import { CreateTaxDto, UpdateTaxDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { id: string };
}

@Controller('taxes')
@UseGuards(JwtAuthGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Post()
  create(@Request() req: AuthRequest, @Body() createTaxDto: CreateTaxDto) {
    return this.taxService.create(req.user.id, createTaxDto);
  }

  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.taxService.findAll(req.user.id);
  }

  @Get('default')
  getDefault(@Request() req: AuthRequest) {
    return this.taxService.getDefault(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.taxService.findOne(req.user.id, id);
  }

  @Put(':id')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() updateTaxDto: UpdateTaxDto,
  ) {
    return this.taxService.update(req.user.id, id, updateTaxDto);
  }

  @Delete(':id')
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.taxService.remove(req.user.id, id);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Patch,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EstimateService } from './estimate.service';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { UpdateEstimateDto, EstimateStatus } from './dto/update-estimate.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('estimates')
@UseGuards(JwtAuthGuard)
export class EstimateController {
  constructor(private readonly estimateService: EstimateService) {}

  @Post()
  create(@Request() req: AuthRequest, @Body() dto: CreateEstimateDto) {
    return this.estimateService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.estimateService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.estimateService.findOne(id, req.user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() dto: UpdateEstimateDto,
  ) {
    return this.estimateService.update(id, req.user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body('status') status: EstimateStatus,
  ) {
    return this.estimateService.updateStatus(id, req.user.id, status);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.estimateService.remove(id, req.user.id);
  }
}

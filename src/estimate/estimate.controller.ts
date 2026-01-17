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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EstimateService } from './estimate.service';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { UpdateEstimateDto, EstimateStatus } from './dto/update-estimate.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('estimates')
export class EstimateController {
  constructor(private readonly estimateService: EstimateService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req: AuthRequest, @Body() dto: CreateEstimateDto) {
    return this.estimateService.create(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req: AuthRequest) {
    return this.estimateService.findAll(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.estimateService.findOne(id, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() dto: UpdateEstimateDto,
  ) {
    return this.estimateService.update(id, req.user.id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body('status') status: EstimateStatus,
  ) {
    return this.estimateService.updateStatus(id, req.user.id, status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.estimateService.remove(id, req.user.id);
  }

  // Public endpoint - no auth required for PDF download
  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.estimateService.generatePdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="estimate-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}

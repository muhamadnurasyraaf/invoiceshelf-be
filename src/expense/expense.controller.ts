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
import { ExpenseService } from './expense.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  create(@Request() req, @Body() createExpenseDto: CreateExpenseDto) {
    return this.expenseService.create(req.user.id, createExpenseDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.expenseService.findAll(req.user.id);
  }

  @Get('summary')
  getSummary(@Request() req) {
    return this.expenseService.getSummary(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.expenseService.findOne(req.user.id, id);
  }

  @Put(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
  ) {
    return this.expenseService.update(req.user.id, id, updateExpenseDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.expenseService.remove(req.user.id, id);
  }
}

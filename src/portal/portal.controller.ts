import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortalService } from './portal.service';

interface AuthRequest {
  user: { id: string; role: string };
}

@Controller('portal')
@UseGuards(JwtAuthGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  // Dashboard
  @Get('dashboard')
  getDashboard(@Request() req: AuthRequest) {
    return this.portalService.getDashboard(req.user.id);
  }

  // Invoices
  @Get('invoices')
  getInvoices(@Request() req: AuthRequest) {
    return this.portalService.getCustomerInvoices(req.user.id);
  }

  @Get('invoices/:id')
  getInvoice(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.portalService.getCustomerInvoice(req.user.id, id);
  }

  // Estimates
  @Get('estimates')
  getEstimates(@Request() req: AuthRequest) {
    return this.portalService.getCustomerEstimates(req.user.id);
  }

  @Get('estimates/:id')
  getEstimate(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.portalService.getCustomerEstimate(req.user.id, id);
  }

  @Post('estimates/:id/accept')
  acceptEstimate(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.portalService.acceptEstimate(req.user.id, id);
  }

  @Post('estimates/:id/reject')
  rejectEstimate(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.portalService.rejectEstimate(req.user.id, id);
  }

  // Payments
  @Get('payments')
  getPayments(@Request() req: AuthRequest) {
    return this.portalService.getCustomerPayments(req.user.id);
  }

  @Get('payments/:id')
  getPayment(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.portalService.getCustomerPayment(req.user.id, id);
  }

  // Profile / Settings
  @Get('profile')
  getProfile(@Request() req: AuthRequest) {
    return this.portalService.getProfile(req.user.id);
  }

  @Patch('profile')
  updateProfile(
    @Request() req: AuthRequest,
    @Body()
    data: {
      companyName?: string;
      contactPersonName?: string;
      phone?: string;
      shippingAddress?: string;
    },
  ) {
    return this.portalService.updateProfile(req.user.id, data);
  }

  @Post('change-password')
  changePassword(
    @Request() req: AuthRequest,
    @Body() data: { currentPassword: string; newPassword: string },
  ) {
    return this.portalService.changePassword(req.user.id, data);
  }
}

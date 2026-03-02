import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { PaymentsService } from './payments.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@ApiTags('Payments')
@Controller('api/v1/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('sale/:saleId')
  @ApiOperation({ summary: 'Get all payments for a sale (ADMIN)' })
  async findBySale(@Param('saleId') saleId: string) {
    return this.paymentsService.findBySale(saleId);
  }

  @Get()
  @ApiOperation({ summary: 'List all payments (ADMIN)' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.paymentsService.findAll(pagination);
  }
}
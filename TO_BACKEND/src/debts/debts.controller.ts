import { Body, Controller as Ctrl2, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { CurrentUser } from '../common/decarators/current.user.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { UserEntity } from '../user/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import * as debtsService from './debts.service';
import { DebtStatus } from './entities/debt.entity';
import { DebtQueryDto, MakePaymentDto } from './dto/create-debt.dto';

@ApiTags('Debts')
@Ctrl2('api/v1/debts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class DebtsController {
  constructor(private readonly debtsService: debtsService.DebtsService) {}

  @Get()
@ApiOperation({ summary: 'List debts (ADMIN)' })
async findAll(@Query() query: DebtQueryDto) {
  return this.debtsService.findAll(query);
}
  @Get(':id')
  @ApiOperation({ summary: 'Get debt by ID (ADMIN)' })
  async findById(@Query('id') id: string) {
    return this.debtsService.findById(id);
  }

 @Post(':id/payment')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Record a debt payment (ADMIN)' })
async makePayment(
  @Param('id') debtId: string,
  @Body() dto: MakePaymentDto,
  @CurrentUser() admin: UserEntity,
) {
  return this.debtsService.makePayment(debtId, dto, admin.id);
}
}
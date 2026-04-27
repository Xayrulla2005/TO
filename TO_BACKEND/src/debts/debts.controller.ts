import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { CurrentUser } from '../common/decarators/current.user.decarator';

import { UserRole } from '../common/dto/roles.enum';
import { UserEntity } from '../user/entities/user.entity';

import { DebtsService } from './debts.service';
import { DebtQueryDto } from './dto/debt.query.dto';
import { MakePaymentDto } from './dto/make.payment.dto';

@ApiTags('Debts')
@Controller('api/v1/debts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // default — o'zgartirilmaydi
@ApiBearerAuth()
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALER) // ✅ SALER ham ko'ra oladi
  @ApiOperation({ summary: 'List debts (ADMIN, SALER)' })
  async findAll(@Query() query: DebtQueryDto) {
    return this.debtsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER) // ✅ SALER ham ko'ra oladi
  @ApiOperation({ summary: 'Get debt by ID (ADMIN, SALER)' })
  async findById(@Param('id') id: string) {
    return this.debtsService.findOne(id);
  }

  @Post(':id/payment')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SALER) // ✅ SALER ham to'lov qila oladi
  @ApiOperation({ summary: 'Record a debt payment (ADMIN, SALER)' })
  async makePayment(
    @Param('id') debtId: string,
    @Body() dto: MakePaymentDto,
    @CurrentUser() admin: UserEntity,
  ) {
    return this.debtsService.makePayment(debtId, dto, admin.id);
  }
}
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import express from 'express';

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
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'List debts (ADMIN, SALER)' })
  async findAll(@Query() query: DebtQueryDto) {
    return this.debtsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Get debt by ID (ADMIN, SALER)' })
  async findById(@Param('id') id: string) {
    return this.debtsService.findOne(id);
  }

  @Post(':id/payment')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Record a debt payment (ADMIN, SALER)' })
  async makePayment(
    @Param('id') debtId: string,
    @Body() dto: MakePaymentDto,
    @CurrentUser() admin: UserEntity,
  ) {
    return this.debtsService.makePayment(debtId, dto, admin.id);
  }

  // ✅ Qarz to'lovi cheki — ?amount=35 query param bilan so'nggi to'lov ko'rsatiladi
  @Get(':id/receipt')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Get debt receipt PDF (ADMIN, SALER)' })
  @ApiQuery({ name: 'amount', required: false, type: Number, description: "So'nggi to'lov summasi" })
  async getReceipt(
    @Param('id') id: string,
    @Query('amount') amount: string | undefined,
    @Res() res: express.Response,
  ) {
    const amountNum = amount ? Number(amount) : undefined;
    return this.debtsService.generateReceipt(id, res, amountNum);
  }
}
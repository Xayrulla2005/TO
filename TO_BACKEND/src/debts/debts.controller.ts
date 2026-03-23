// src/debts/debts.controller.ts — PRODUCTION COMPLETE v3
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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
@ApiBearerAuth()
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  // GET /debts
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'List debts' })
  async findAll(@Query() query: DebtQueryDto) {
    return this.debtsService.findAll(query);
  }

  // GET /debts/summary
  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Debt summary statistics' })
  async getSummary() {
    return this.debtsService.getDebtSummary();
  }

  // GET /debts/:id
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Get debt by ID' })
  async findById(@Param('id') id: string) {
    return this.debtsService.findOneWithPayments(id);
  }

  // GET /debts/:id/payments
  @Get(':id/payments')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: "Qarz to'lovlar tarixi" })
  async getPayments(@Param('id') id: string) {
    return this.debtsService.getPayments(id);
  }

  // POST /debts/:id/payment
  @Post(':id/payment')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: "Qarz to'lovini qayd qilish" })
  async makePayment(
    @Param('id') debtId: string,
    @Body() dto: MakePaymentDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.debtsService.makePayment(debtId, dto, user.id);
  }

  // GET /debts/:id/receipt — soddalashtirilgan chek PDF
  // totalOriginal, paidAmount, currentRemaining — bulk to'lov uchun (frontend yuboradi)
  @Get(':id/receipt')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: "Qarz to'lov cheki PDF" })
  @ApiQuery({ name: 'paymentId',        required: false, type: String })
  @ApiQuery({ name: 'amount',           required: false, type: Number })
  @ApiQuery({ name: 'totalOriginal',    required: false, type: Number, description: 'Bulk: umumiy asl qarz' })
  @ApiQuery({ name: 'paidAmount',       required: false, type: Number, description: 'Bulk: hozir to\'langan' })
  @ApiQuery({ name: 'currentRemaining', required: false, type: Number, description: 'Bulk: joriy qoldiq' })
  @ApiQuery({ name: 'paymentMethod',    required: false, type: String, description: 'CASH | CARD' })
  async getReceipt(
    @Param('id') id: string,
    @Query('paymentId')        paymentId:        string | undefined,
    @Query('amount')           amount:           string | undefined,
    @Query('totalOriginal')    totalOriginal:    string | undefined,
    @Query('paidAmount')       paidAmount:       string | undefined,
    @Query('currentRemaining') currentRemaining: string | undefined,
    @Query('paymentMethod')    paymentMethod:    string | undefined,
    @Res() res: express.Response,
  ) {
    return this.debtsService.generateReceipt(
      id,
      res,
      amount           ? Number(amount)           : undefined,
      paymentId,
      totalOriginal    ? Number(totalOriginal)    : undefined,
      paidAmount       ? Number(paidAmount)       : undefined,
      currentRemaining ? Number(currentRemaining) : undefined,
      paymentMethod,
    );
  }

  // POST /debts/:id/cancel
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Qarzni bekor qilish (faqat ADMIN)" })
  async cancel(
    @Param('id') debtId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.debtsService.cancel(debtId, user.id);
  }
}
// ============================================================
// src/sales/sales.controller.ts
// ============================================================
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SalesService } from './sale.service';
import {
  CreateSaleDto,
  CompleteSaleDto,
  CancelSaleDto,
  UpdateSaleDto,
} from './dto/create-sale.dto';
import { SaleStatus } from './entities/sale.entity';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { CurrentUser } from '../common/decarators/current.user.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { UserEntity } from '../user/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import express from 'express';
import { ReceiptService } from './resipt.service';

@ApiTags('Sales')
@Controller('api/v1/sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly receiptService: ReceiptService,
  ) {}

  // ─── Create Sale (DRAFT) ───────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new sale in DRAFT status' })
  @ApiResponse({ status: 201, description: 'Sale created in DRAFT' })
  async create(@Body() dto: CreateSaleDto, @CurrentUser() user: UserEntity) {
    return this.salesService.createSale(dto, user.id);
  }

  // ─── Update Sale Items (DRAFT only) ───────────────────────
  @Put(':id/items')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Update sale items (DRAFT only).' })
  @ApiResponse({ status: 200, description: 'Sale updated' })
  async updateItems(
    @Param('id') saleId: string,
    @Body() dto: UpdateSaleDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.salesService.updateSale(saleId, dto, user.id, user.role);
  }

  // ─── Complete Sale ─────────────────────────────────────────
  @Post(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete a DRAFT sale. Returns debtSummary with previousDebt, currentSaleDebt, totalDebtAfter.',
  })
  @ApiResponse({ status: 200, description: 'Sale completed' })
  @ApiResponse({ status: 400, description: 'Insufficient stock or payment mismatch' })
  async complete(
    @Param('id') saleId: string,
    @Body() dto: CompleteSaleDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.salesService.completeSale(saleId, dto, user.id);
  }

  // ─── Cancel Sale (ADMIN only) ──────────────────────────────
  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a sale (ADMIN only). Reverses inventory if COMPLETED.' })
  @ApiResponse({ status: 200, description: 'Sale cancelled' })
  async cancel(
    @Param('id') saleId: string,
    @Body() dto: CancelSaleDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.salesService.cancelSale(saleId, dto, user.id);
  }

  // ─── List Sales ────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'List sales.' })
  @ApiQuery({ name: 'status', enum: SaleStatus, required: false })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('status') status?: SaleStatus,
  ) {
    return this.salesService.findAll(pagination);
  }

  // ─── Get Sale by ID ────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Get sale details by ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async findById(@Param('id') saleId: string) {
    return this.salesService.findById(saleId);
  }

  // ─── Receipt ───────────────────────────────────────────────
  @Get(':id/receipt')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Generate PDF receipt for completed sale' })
  async getReceipt(
    @Param('id') saleId: string,
    @Res() res: express.Response,
  ) {
    // Load sale with freshly recomputed debtSummary so receipt always
    // shows correct previousDebt / currentSaleDebt / totalDebtAfter
    // regardless of when this endpoint is called relative to completion.
    const sale = await this.salesService.getSaleWithDebtSummary(saleId);

    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Receipt available only for completed sales');
    }

    return this.receiptService.generateReceipt(sale, res);
  }
}
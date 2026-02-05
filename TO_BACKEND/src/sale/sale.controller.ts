// ============================================================
// src/sales/sales.controller.ts
// ============================================================
import {
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

@ApiTags('Sales')
@Controller('api/v1/sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ─── Create Sale (DRAFT) – Both ADMIN and SALER ────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new sale in DRAFT status' })
  @ApiResponse({ status: 201, description: 'Sale created in DRAFT' })
  async create(@Body() dto: CreateSaleDto, @CurrentUser() user: UserEntity) {
    return this.salesService.createSale(dto, user.id);
  }

  // ─── Update Sale Items (DRAFT only) – Both roles ───────
  @Put(':id/items')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Update sale items (DRAFT only). SALER can only change customUnitPrice and discountAmount.' })
  @ApiResponse({ status: 200, description: 'Sale updated' })
  async updateItems(
    @Param('id') saleId: string,
    @Body() dto: UpdateSaleDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.salesService.updateSale(saleId, dto, user.id, user.role);
  }

  // ─── Complete Sale – Both roles ─────────────────────────
  @Post(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a DRAFT sale. Decreases inventory and records payments.' })
  @ApiResponse({ status: 200, description: 'Sale completed' })
  @ApiResponse({ status: 400, description: 'Insufficient stock or payment mismatch' })
  async complete(
    @Param('id') saleId: string,
    @Body() dto: CompleteSaleDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.salesService.completeSale(saleId, dto, user.id);
  }

  // ─── Cancel Sale – ADMIN only ───────────────────────────
  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a sale (ADMIN only). Reverses inventory if sale was COMPLETED.' })
  @ApiResponse({ status: 200, description: 'Sale cancelled' })
  async cancel(
    @Param('id') saleId: string,
    @Body() dto: CancelSaleDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.salesService.cancelSale(saleId, dto, user.id);
  }

  // ─── List Sales – ADMIN sees all, SALER sees only their own ──
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'List sales. SALER sees only their sales.' })
  @ApiQuery({ name: 'status', enum: SaleStatus, required: false })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('status') status?: SaleStatus,
  ) {
    return this.salesService.findAll(pagination);
  }

  // ─── Get Sale by ID ─────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Get sale details by ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async findById(@Param('id') saleId: string) {
    return this.salesService.findById(saleId);
  }
}
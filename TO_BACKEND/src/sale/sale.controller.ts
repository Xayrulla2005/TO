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
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager_1 from 'cache-manager';
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
import { SaleQueryDto } from './dto/sale.query.dto';
import express from 'express';
import { ReceiptService } from './resipt.service';

// Kesh key'lari — bir joyda boshqarish uchun
const CACHE_KEYS = {
  SALES_LIST: 'sales_list',
} as const;

@ApiTags('Sales')
@Controller('api/v1/sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly receiptService: ReceiptService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: cacheManager_1.Cache,
  ) {}

  // Kesh tozalash helper
  private async invalidateSalesCache(): Promise<void> {
    try {
      await this.cacheManager.del(CACHE_KEYS.SALES_LIST);
    } catch {
      // Kesh xatosi asosiy jarayonni to'xtata olmaydi
    }
  }

  // 1. Create Sale (DRAFT)
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new sale in DRAFT status' })
  async create(@Body() dto: CreateSaleDto, @CurrentUser() user: UserEntity) {
    const result = await this.salesService.create(dto, user.id, user.role);
    await this.invalidateSalesCache();
    return result;
  }

  // 2. Update Sale (faqat DRAFT)
  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Update sale notes (DRAFT only)' })
  async update(
    @Param('id') saleId: string,
    @Body() dto: UpdateSaleDto,
    @CurrentUser() user: UserEntity,
  ) {
    const result = await this.salesService.update(saleId, dto, user.id);
    await this.invalidateSalesCache();
    return result;
  }

  // 3. Complete Sale
  @Post(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a DRAFT sale' })
  async complete(
    @Param('id') saleId: string,
    @Body() dto: CompleteSaleDto,
    @CurrentUser() user: UserEntity,
  ) {
    const result = await this.salesService.completeSale(saleId, dto, user.id);
    await this.invalidateSalesCache();
    return result;
  }

  // 4. List Sales — KESH BILAN (30 soniya)
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @UseInterceptors(CacheInterceptor)
  @CacheKey(CACHE_KEYS.SALES_LIST)
  @CacheTTL(30_000) // 30 soniya (millisecond)
  @ApiOperation({ summary: 'List sales (cached 30s)' })
  async findAll(@Query() queryDto: SaleQueryDto) {
    return this.salesService.findAll(queryDto);
  }

  // 5. Get Sale by ID — KESH BILAN (60 soniya)
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60_000) // 60 soniya
  @ApiOperation({ summary: 'Get sale details by ID' })
  async findById(@Param('id') saleId: string) {
    return this.salesService.findOne(saleId);
  }

  // 6. Receipt PDF
  @Get(':id/receipt')
  @Roles(UserRole.ADMIN, UserRole.SALER)
  @ApiOperation({ summary: 'Generate PDF receipt' })
  async getReceipt(
    @Param('id') saleId: string,
    @Res() res: express.Response,
  ) {
    const sale = await this.salesService.findOne(saleId);
    if (!sale || sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Receipt faqat yakunlangan sotuvlar uchun');
    }
    return this.receiptService.generateReceipt(sale, res);
  }

  // 7. Cancel Sale (faqat ADMIN)
  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a sale (ADMIN only)' })
  async cancel(
    @Param('id') saleId: string,
    @Body() dto: CancelSaleDto,
  ) {
    const result = await this.salesService.cancel(saleId, dto);
    await this.invalidateSalesCache();
    return result;
  }
}
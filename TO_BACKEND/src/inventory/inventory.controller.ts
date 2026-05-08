// ============================================================
// src/inventory/inventory.controller.ts
// ============================================================
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
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import express from 'express';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { CurrentUser } from '../common/decarators/current.user.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { UserEntity } from '../user/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import * as inventoryService_1 from './inventory.service';

@ApiTags('Inventory')
@Controller('api/v1/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: inventoryService_1.InventoryService) {}

  @Post('adjust')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ombor qoldig\'ini qo\'lda o\'zgartirish (ADMIN)' })
  async adjustStock(
    @Body() dto: inventoryService_1.AdjustStockDto, 
    @CurrentUser() admin: UserEntity
  ) {
    return this.inventoryService.adjustStock(dto, admin.id);
  }

  @Get('export/excel')
  @ApiOperation({ summary: 'Barcha ombor harakatlarini Excel ko\'rinishida yuklab olish (ADMIN)' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportToExcel(@Res() res: express.Response) {
    // Service ichidagi downloadExcel Express res obyektiga to'g'ridan-to'g'ri stream yozadi
    return await this.inventoryService.downloadExcel(res);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Barcha ombor harakatlarini ko\'rish (ADMIN)' })
  async getAllTransactions(@Query() pagination: PaginationDto) {
    return this.inventoryService.getAllTransactions(pagination);
  }

  @Get('products/:productId/transactions')
  @ApiOperation({ summary: 'Ma\'lum bir mahsulot bo\'yicha harakatlar tarixini ko\'rish (ADMIN)' })
  async getTransactionsByProduct(
    @Param('productId') productId: string, 
    @Query() pagination: PaginationDto
  ) {
    return this.inventoryService.getTransactionsByProduct(productId, pagination);
  }
}
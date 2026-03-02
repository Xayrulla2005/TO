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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { CurrentUser } from '../common/decarators/current.user.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { UserEntity } from '../user/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import * as inventoryService from './inventory.service';

@ApiTags('Inventory')
@Controller('api/v1/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: inventoryService.InventoryService) {}

  @Post('adjust')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Manually adjust product stock (ADMIN)' })
  async adjustStock(@Body() dto: inventoryService.AdjustStockDto, @CurrentUser() admin: UserEntity) {
    return this.inventoryService.adjustStock(dto, admin.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get all inventory transactions (ADMIN)' })
  async getAllTransactions(@Query() pagination: PaginationDto) {
    return this.inventoryService.getAllTransactions(pagination);
  }

  @Get('products/:productId/transactions')
  @ApiOperation({ summary: 'Get inventory transactions for a specific product (ADMIN)' })
  async getTransactionsByProduct(@Param('productId') productId: string, @Query() pagination: PaginationDto) {
    return this.inventoryService.getTransactionsByProduct(productId, pagination);
  }
}
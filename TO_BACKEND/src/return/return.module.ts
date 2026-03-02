// ============================================================
// src/returns/returns.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReturnEntity } from './entities/return.entity';
import { ReturnItemEntity } from './entities/return.item.entity';
import { SaleEntity } from '../sale/entities/sale.entity';
import { SaleItemEntity } from '../sale/entities/sale.item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory.entity';
import { ReturnsService } from './return.service';
import {  ReturnsController } from './return.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReturnEntity,
      ReturnItemEntity,
      SaleEntity,
      SaleItemEntity,
      ProductEntity,
      InventoryTransactionEntity,
    ]),
    CommonModule,
  ],
  providers: [ReturnsService],
  controllers: [ReturnsController],
  exports: [ReturnsService],
})
export class ReturnsModule {}
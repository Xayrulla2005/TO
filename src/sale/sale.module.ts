import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleEntity } from './entities/sale.entity';
import { SaleItemEntity } from './entities/sale.item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { DebtEntity } from '../debts/entities/debt.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory.entity';
import { SalesService } from './sale.service';
import { SalesController } from './sale.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaleEntity,
      SaleItemEntity,
      ProductEntity,
      PaymentEntity,
      DebtEntity,
      InventoryTransactionEntity,
    ]),
    CommonModule,
  ],
  providers: [SalesService],
  controllers: [SalesController],
  exports: [SalesService],
})
export class SalesModule {}
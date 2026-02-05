import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleEntity } from '../sale/entities/sale.entity';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { DebtEntity } from '../debts/entities/debt.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { ReturnEntity } from '../return/entities/return.entity';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaleEntity,
      PaymentEntity,
      DebtEntity,
      ProductEntity,
      CategoryEntity,
      ReturnEntity,
    ]),
    CommonModule,
  ],
  providers: [StatisticsService],
  controllers: [StatisticsController],
  exports: [StatisticsService],
})
export class StatisticsModule {}
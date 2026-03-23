// src/debts/debts.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtEntity } from './entities/debt.entity';
import { DebtPaymentEntity } from './entities/debt-payment.entity';
import { DebtsService } from './debts.service';
import { DebtsController } from './debts.controller';
import { CommonModule } from '../common/common.module';
import { SaleEntity } from '../sale/entities/sale.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DebtEntity,
      DebtPaymentEntity,
      SaleEntity,
    ]),
    CommonModule,
  ],
  providers: [DebtsService],
  controllers: [DebtsController],
  exports: [DebtsService],
})
export class DebtsModule {}
import { Module as Mod3 } from '@nestjs/common';
import { TypeOrmModule as TO3, TypeOrmModule } from '@nestjs/typeorm';
import { DebtEntity as DE3, DebtEntity } from './entities/debt.entity';
import { DebtsService } from './debts.service';
import { DebtsController } from './debts.controller';
import { CommonModule as CM3 } from '../common/common.module';
import { SaleEntity } from 'src/sale/entities/sale.entity';

@Mod3({
  imports: [
    TO3.forFeature([DE3]), CM3,
  TypeOrmModule.forFeature([
      DebtEntity,
      SaleEntity, // ✅ SHART
    ]),
  ],
  providers: [DebtsService],
  controllers: [DebtsController],
  exports: [DebtsService],
})
export class DebtsModule {}
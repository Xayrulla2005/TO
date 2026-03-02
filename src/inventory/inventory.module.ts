import { Module as Mod2 } from '@nestjs/common';
import { TypeOrmModule as TO2 } from '@nestjs/typeorm';
import { InventoryTransactionEntity as ITE } from './entities/inventory.entity';
import { ProductEntity as PE2 } from '../products/entities/product.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { CommonModule as CM2 } from '../common/common.module';

@Mod2({
  imports: [TO2.forFeature([ITE, PE2]), CM2],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
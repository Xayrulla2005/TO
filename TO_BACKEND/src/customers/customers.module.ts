import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerEntity } from './entities/customer.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { SaleEntity } from '../sale/entities/sale.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerEntity, SaleEntity])],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}

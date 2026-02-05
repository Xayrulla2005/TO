// ============================================================
// src/products/products.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ProductEntity } from './entities/product.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ImageService } from './services/image.service';
import { CommonModule } from '../common/common.module';
import { multerOptions } from './config/multer.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity, CategoryEntity]),
    MulterModule.register(multerOptions),
    CommonModule,
  ],
  providers: [ProductsService, ImageService],
  controllers: [ProductsController],
  exports: [ProductsService, ImageService],
})
export class ProductsModule {}
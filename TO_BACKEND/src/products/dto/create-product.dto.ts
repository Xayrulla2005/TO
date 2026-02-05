// ============================================================
// src/products/dto/product.dto.ts
// ============================================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, IsEnum, IsOptional, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { ProductUnit } from '../entities/product.entity';

export class CreateProductDto {
  @ApiProperty({ example: 'Wooden Shelf' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional({ description: 'Category UUID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ example: 25.50, description: 'Purchase/cost price' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purchasePrice!: number;

  @ApiProperty({ example: 49.99, description: 'Base sale price' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salePrice!: number;

  @ApiPropertyOptional({ enum: ProductUnit, default: ProductUnit.PIECE })
  @IsOptional()
  @IsEnum(ProductUnit)
  unit?: ProductUnit;

  @ApiPropertyOptional({ example: 100, description: 'Initial stock quantity' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 10, description: 'Minimum stock threshold for alerts' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minStockLimit?: number;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductResponseDto {
  id!: string;
  name!: string;
  categoryId?: string | null;
  categoryName?: string | null;
  purchasePrice!: number;
  salePrice!: number;
  imageUrl?: string | null;
  unit!: string;
  stockQuantity!: number;
  minStockLimit!: number;
  isLowStock!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(product: { id: string; name: string; categoryId?: string | null; category?: { name: string } | null; purchasePrice: number; salePrice: number; imageUrl?: string | null; unit: string; stockQuantity: number; minStockLimit: number; createdAt: Date; updatedAt: Date }): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.name = product.name;
    dto.categoryId = product.categoryId ?? null;
    dto.categoryName = product.category?.name ?? null;
    dto.purchasePrice = Number(product.purchasePrice);
    dto.salePrice = Number(product.salePrice);
    dto.imageUrl = product.imageUrl ? `/uploads/${product.imageUrl}` : null;
    dto.unit = product.unit;
    dto.stockQuantity = Number(product.stockQuantity);
    dto.minStockLimit = Number(product.minStockLimit);
    dto.isLowStock = dto.stockQuantity <= dto.minStockLimit;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;
    return dto;
  }
}
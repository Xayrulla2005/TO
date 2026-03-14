import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, IsEnum, IsOptional, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { ProductUnit } from '../entities/product.entity';

export class CreateProductDto {
  @ApiProperty({ example: 'Yog\' bo\'yoq' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional({ description: 'Category UUID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ example: 25.50 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purchasePrice!: number;

  @ApiProperty({ example: 49.99 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salePrice!: number;

  @ApiPropertyOptional({
    enum: ProductUnit,
    default: ProductUnit.PIECE,
    description: 'O\'lchov birligi: piece=dona, meter=metr, kg=kilogram, litre=litr',
  })
  @IsOptional()
  @IsEnum(ProductUnit)
  unit?: ProductUnit;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minStockLimit?: number;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
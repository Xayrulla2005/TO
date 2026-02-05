// ============================================================
// src/returns/dto/return.dto.ts
// ============================================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsOptional, IsNumber, Min, IsUUID, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnItemInputDto {
  @ApiProperty({ description: 'Original sale item ID' })
  @IsUUID()
  saleItemId!: string;

  @ApiProperty({ example: 1, description: 'Quantity to return' })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateReturnDto {
  @ApiProperty({ description: 'Original sale ID' })
  @IsUUID()
  originalSaleId!: string;

  @ApiProperty({ description: 'Items to return' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items!: ReturnItemInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveReturnDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectReturnDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  reason!: string;
}


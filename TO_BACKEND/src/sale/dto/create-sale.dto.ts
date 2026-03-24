import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
  ArrayNotEmpty,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../payments/entities/payment.entity';

// ───────────────────────────────────────────────────────────
// SALE ITEM INPUT
// ───────────────────────────────────────────────────────────
export class SaleItemInputDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  customUnitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountAmount?: number;
}

// ───────────────────────────────────────────────────────────
// CREATE SALE
// ───────────────────────────────────────────────────────────
export class CreateSaleDto {
  @ApiProperty({ type: [SaleItemInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ───────────────────────────────────────────────────────────
// PAYMENT INPUT
// ───────────────────────────────────────────────────────────
export class PaymentInputDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ───────────────────────────────────────────────────────────
// COMPLETE SALE (ENG MUHIM)
// ───────────────────────────────────────────────────────────
export class CompleteSaleDto {
  @ApiProperty({ type: [PaymentInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PaymentInputDto)
  payments!: PaymentInputDto[];

  // ── Existing customer ───────────────────────────────
  @ApiPropertyOptional({ description: 'Existing customer UUID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  // ── New customer ───────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string;

  // ── Debt (backward compatibility) ──────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  debtorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  debtorPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  debtDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  debtNotes?: string;

  // ── AGREED TOTAL (CRITICAL FIX) ────────────────────
  @ApiPropertyOptional({
    description: 'Manual override of total price (agreed price)',
    example: 120.5,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  agreedTotal?: number;
}

// ───────────────────────────────────────────────────────────
// UPDATE SALE ITEM
// ───────────────────────────────────────────────────────────
export class UpdateSaleItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  customUnitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountAmount?: number;
}

// ───────────────────────────────────────────────────────────
// UPDATE SALE
// ───────────────────────────────────────────────────────────
export class UpdateSaleDto {
  @ApiProperty({ type: [UpdateSaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSaleItemDto)
  items!: UpdateSaleItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ───────────────────────────────────────────────────────────
// CANCEL SALE
// ───────────────────────────────────────────────────────────
export class CancelSaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
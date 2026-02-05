// ============================================================
// src/sales/dto/sale.dto.ts
// ============================================================
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

// ─── Sale Item Input ────────────────────────────────────────
export class SaleItemInputDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ example: 2, description: 'Quantity' })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Custom unit price (overrides product base price). SALER can only set this.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  customUnitPrice?: number;

  @ApiPropertyOptional({ example: 5, description: 'Discount amount per item' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountAmount?: number;
}

// ─── Create Sale (DRAFT) ────────────────────────────────────
export class CreateSaleDto {
  @ApiProperty({ description: 'Array of sale items' })
  @IsArray()
  @ArrayNotEmpty({ message: 'Sale must have at least one item' })
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];

  @ApiPropertyOptional({ description: 'Notes for the sale' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Complete Sale (triggers inventory decrease) ───────────
export class CompleteSaleDto {
  @ApiProperty({ description: 'Payment entries for this sale' })
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one payment method is required' })
  @ValidateNested({ each: true })
  @Type(() => PaymentInputDto)
  payments!: PaymentInputDto[];

  @ApiPropertyOptional({ description: 'Debtor name (required if any payment is DEBT)' })
  @IsOptional()
  @IsString()
  debtorName?: string;

  @ApiPropertyOptional({ description: 'Debtor phone (required if any payment is DEBT)' })
  @IsOptional()
  @IsString()
  debtorPhone?: string;

  @ApiPropertyOptional({ description: 'Due date for debt payment' })
  @IsOptional()
  @IsString()
  debtDueDate?: string; // ISO date string
  dueDate: any;
  debtNotes: any;
}

export class PaymentInputDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ example: 100.00 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Cancel Sale ────────────────────────────────────────────
export class CancelSaleDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── Update Sale Item (SALER can only change customUnitPrice and discountAmount) ──
export class UpdateSaleItemDto {
  @ApiProperty({ description: 'Sale item UUID' })
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @ApiPropertyOptional({ description: 'Custom unit price override' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  customUnitPrice?: number;

  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountAmount?: number;
}

export class UpdateSaleDto {
  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSaleItemDto)
  items!: UpdateSaleItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Sale Response ──────────────────────────────────────────
export class SaleResponseDto {
  id!: string;
  saleNumber!: string;
  status!: string;
  subtotal!: number;
  totalDiscount!: number;
  grandTotal!: number;
  grossProfit!: number;
  netProfit!: number;
  notes?: string | null;
  createdById!: string;
  createdByUsername!: string;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  items!: SaleItemResponseDto[];
  payments?: PaymentResponseDto[];
  debt?: DebtResponseDto;
}

export class SaleItemResponseDto {
  id!: string;
  productId?: string | null;
  productNameSnapshot!: string;
  categorySnapshot?: string | null;
  baseUnitPrice!: number;
  customUnitPrice!: number;
  purchasePriceSnapshot!: number;
  quantity!: number;
  unitSnapshot!: string;
  baseTotal!: number;
  customTotal!: number;
  discountAmount!: number;
}

export class PaymentResponseDto {
  id!: string;
  method!: string;
  amount!: number;
  notes?: string | null;
  createdAt!: Date;
}

export class DebtResponseDto {
  id!: string;
  debtorName!: string;
  debtorPhone!: string;
  originalAmount!: number;
  remainingAmount!: number;
  status!: string;
  dueDate?: Date | null;
}
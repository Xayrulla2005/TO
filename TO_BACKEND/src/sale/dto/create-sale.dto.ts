import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsNumber, Min, IsArray,
  ValidateNested, IsOptional, IsEnum, ArrayNotEmpty, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../payments/entities/payment.entity';

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

export class CreateSaleDto {
  @ApiProperty()
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

export class CompleteSaleDto {
  @ApiProperty({ type: [PaymentInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PaymentInputDto)
  payments!: PaymentInputDto[];

  // ── Mavjud mijoz ID si ─────────────────────────────────
  @ApiPropertyOptional({ description: 'Existing customer UUID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  // ── Yangi mijoz yoki qarz uchun ────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string;

  // ── Qarz uchun (eski fieldlar - backward compat) ───────
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
}

export class CancelSaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

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
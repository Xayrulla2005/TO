// src/debts/dto/make-payment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum DebtPaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
}

export class MakePaymentDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: DebtPaymentMethod })
  @IsEnum(DebtPaymentMethod)
  paymentMethod!: DebtPaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

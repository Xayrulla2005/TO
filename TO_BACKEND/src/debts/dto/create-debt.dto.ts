import { IsOptional, IsEnum } from 'class-validator';
import { SaleStatus } from '../../common/enums/sale.status.enum';
export class MakePaymentDto {
  amount!: number;
  paymentDate?: Date;
  note?: string;
}


export class DebtQueryDto {
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}
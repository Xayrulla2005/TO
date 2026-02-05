import { PartialType } from '@nestjs/mapped-types';
import { MakePaymentDto } from './create-debt.dto';

export class UpdateDebtDto extends PartialType(MakePaymentDto) {}

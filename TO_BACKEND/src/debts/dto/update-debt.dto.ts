import { PartialType } from '@nestjs/mapped-types';
import {DebtQueryDto} from './debt.query.dto';

export class UpdateDebtDto extends PartialType(DebtQueryDto) {}

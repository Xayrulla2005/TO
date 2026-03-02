import { PaginationDto } from '../../common/dto/pagination.dto';
import { SaleStatus } from '../../common/enums/sale.status.enum';

export class SaleQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: SaleStatus;
}
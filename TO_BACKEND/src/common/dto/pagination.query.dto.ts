// ============================================================
// src/common/dto/pagination.query.dto.ts
// ============================================================
import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "./pagination.dto";

export class ProductQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Mahsulot nomi bo'yicha qidiruv" })
  @IsOptional()
  @IsString()
  search?: string;
}
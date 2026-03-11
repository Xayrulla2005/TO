import { IsString, IsOptional } from 'class-validator';

export class CreateCustomerDto {

  @IsString()
  name!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  notes?: string;

}

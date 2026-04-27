import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateCustomerDto {
  @IsString() @IsNotEmpty() @MaxLength(150) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(20) phone!: string;
  @IsOptional() @IsString() notes?: string;
}

// src/auth/dto/register.auth.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { UserRole } from '../../common/dto/roles.enum';

export class RegisterDto {
  @ApiProperty({ description: 'To\'liq ism' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 150)
  fullName!: string;

  @ApiProperty({ description: 'Telefon raqami', example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?998\d{9}$/, {
    message: 'Telefon raqami noto\'g\'ri formatda',
  })
  phone!: string;

  @ApiProperty({ description: 'Parol' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 255)
  password!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.SALER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
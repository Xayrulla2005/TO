// src/users/dto/create-user.dto.ts
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
import { PartialType } from '@nestjs/mapped-types';
import { UserRole } from '../../common/dto/roles.enum';
import { UserEntity } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ description: 'To\'liq ism' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 150)
  fullName!: string;

  @ApiProperty({ description: 'Telefon raqami', example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?998\d{9}$/, {
    message: 'Telefon raqami noto\'g\'ri formatda (+998XXXXXXXXX)',
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

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string; // Update da ixtiyoriy
}

export class UserResponseDto {
  id!: string;
  fullName!: string;
  phone!: string;
  role!: UserRole;
  isActive!: boolean;
  createdAt!: Date;

  static fromEntity(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      fullName: user.fullName, // Hozircha username ni fullName sifatida qaytaramiz
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
// ============================================================
// src/users/dto/user.dto.ts
// ============================================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, Length, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { UserRole } from '../../common/dto/roles.enum';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  username!: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(8, 255)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UserResponseDto {
  id!: string;
  username!: string;
  email!: string;
  role!: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive!: boolean;
  lastLoginAt?: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(user: { id: string; username: string; email: string; role: string; firstName?: string | null; lastName?: string | null; isActive: boolean; lastLoginAt?: Date | null; createdAt: Date; updatedAt: Date }): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.username = user.username;
    dto.email = user.email;
    dto.role = user.role;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.isActive = user.isActive;
    dto.lastLoginAt = user.lastLoginAt;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}


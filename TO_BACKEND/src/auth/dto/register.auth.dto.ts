import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, Length, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '../../common/dto/roles.enum';

export class RegisterDto {
  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  username!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'secureP@ss123', description: 'Min 8 chars, must contain uppercase, lowercase, number' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 255)
  password!: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.SALER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.SALER;
}
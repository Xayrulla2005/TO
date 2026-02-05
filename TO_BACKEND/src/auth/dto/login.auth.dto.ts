import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Username' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  username!: string;

  @ApiProperty({ example: 'secureP@ss123', description: 'Password' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 255)
  password!: string;
}
// src/auth/dto/login.auth.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ 
    description: 'To\'liq ism (Login uchun)', 
    example: 'Xayrulla Aliyev' 
  })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ 
    description: 'Parol',
    example: 'Xayrulla2005+' 
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
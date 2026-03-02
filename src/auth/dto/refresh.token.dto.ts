import { ApiProperty as AP2 } from '@nestjs/swagger';
import { IsString as IS2, IsNotEmpty as INE2 } from 'class-validator';

export class RefreshTokenDto {
  @AP2({ description: 'Refresh token from cookie' })
  @IS2()
  @INE2()
  refreshToken!: string;
}
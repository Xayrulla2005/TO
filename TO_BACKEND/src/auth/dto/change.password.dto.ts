import { ApiProperty as AP3 } from '@nestjs/swagger';
import { IsString as IS3, IsNotEmpty as INE3, Length as Len3 } from 'class-validator';

export class ChangePasswordDto {
  @AP3({ description: 'Current password' })
  @IS3()
  @INE3()
  currentPassword!: string;

  @AP3({ description: 'New password (min 8 chars)' })
  @IS3()
  @INE3()
  @Len3(8, 255)
  newPassword!: string;
}
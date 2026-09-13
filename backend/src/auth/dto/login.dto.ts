import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@expert.sarlu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '••••••••' })
  @IsString()
  @MinLength(8)
  password!: string;
}

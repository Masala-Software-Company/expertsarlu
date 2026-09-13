import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsBoolean, IsString, MinLength } from 'class-validator';
import { RoleName } from '@prisma/client';
import { UsersService } from './users.service';
import { RequireRole } from '../auth/decorators';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

class CreateUserDto {
  @ApiProperty()
  @IsString()
  nom!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: RoleName })
  @IsEnum(RoleName)
  role!: RoleName;
}

class ActifDto {
  @ApiProperty()
  @IsBoolean()
  actif!: boolean;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@RequireRole('SUPER_ADMIN')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id/actif')
  setActif(
    @Param('id') id: string,
    @Body() dto: ActifDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.setActif(id, dto.actif, user);
  }
}

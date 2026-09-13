import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
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

class UpdateRoleDto {
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

  @Get('roles')
  listRoles() {
    return this.users.listRoles();
  }

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.updateRole(id, dto.role, user);
  }

  @Patch(':id/actif')
  setActif(
    @Param('id') id: string,
    @Body() dto: ActifDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.setActif(id, dto.actif, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.users.remove(id, user);
  }
}

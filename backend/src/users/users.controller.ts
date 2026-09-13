import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { RoleName } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { RequireRole } from '../auth/decorators';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

const imageUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

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

class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  nom?: string;

  @ApiPropertyOptional({ enum: RoleName })
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsString()
  @MinLength(8)
  password?: string;
}

class ChangePasswordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword!: string;
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
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('roles')
  @RequireRole('SUPER_ADMIN')
  listRoles() {
    return this.users.listRoles();
  }

  @Get()
  @RequireRole('SUPER_ADMIN')
  list() {
    return this.users.list();
  }

  @Get(':id/photo')
  async photo(@Param('id') id: string, @Res() res: Response) {
    const meta = await this.users.getPhoto(id);
    if (!meta) throw new NotFoundException('Photo introuvable');
    res.setHeader('Content-Type', meta.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    meta.stream.pipe(res);
  }

  @Get(':id')
  @RequireRole('SUPER_ADMIN')
  getOne(@Param('id') id: string) {
    return this.users.getById(id);
  }

  @Post()
  @RequireRole('SUPER_ADMIN')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, { nom: dto.nom }, user);
  }

  @Patch('me/password')
  changeMyPassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.id, dto, user);
  }

  @Post('me/photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(imageUpload)
  uploadMyPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.users.uploadPhoto(user.id, file, user);
  }

  @Patch(':id')
  @RequireRole('SUPER_ADMIN')
  updateMember(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.updateProfile(id, dto, user);
  }

  @Patch(':id/password')
  @RequireRole('SUPER_ADMIN')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.changePassword(id, { newPassword: dto.newPassword }, user);
  }

  @Post(':id/photo')
  @RequireRole('SUPER_ADMIN')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(imageUpload)
  uploadMemberPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.uploadPhoto(id, file, user);
  }

  @Patch(':id/role')
  @RequireRole('SUPER_ADMIN')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.updateRole(id, dto.role, user);
  }

  @Patch(':id/actif')
  @RequireRole('SUPER_ADMIN')
  setActif(
    @Param('id') id: string,
    @Body() dto: ActifDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.setActif(id, dto.actif, user);
  }

  @Delete(':id')
  @RequireRole('SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.users.remove(id, user);
  }
}

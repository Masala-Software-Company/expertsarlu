import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CommunicationsService } from './communications.service';
import { RequirePermission } from '../auth/decorators';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

class CreateCommDto {
  @ApiProperty({ enum: ['EMAIL', 'WHATSAPP', 'INTERNE', 'APPEL'] })
  @IsIn(['EMAIL', 'WHATSAPP', 'INTERNE', 'APPEL'])
  canal!: string;

  @ApiPropertyOptional({ enum: ['ENTRANT', 'SORTANT'] })
  @IsOptional()
  @IsIn(['ENTRANT', 'SORTANT'])
  sens?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sujet?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  corps!: string;
}

@ApiTags('communications')
@ApiBearerAuth()
@Controller('communications')
export class CommunicationsController {
  constructor(private communications: CommunicationsService) {}

  @Get('dossier/:dossierId')
  @RequirePermission({ module: 'dossiers', action: 'read' })
  list(@Param('dossierId') dossierId: string) {
    return this.communications.list(dossierId);
  }

  @Post('dossier/:dossierId')
  @RequirePermission({ module: 'dossiers', action: 'update' })
  create(
    @Param('dossierId') dossierId: string,
    @Body() dto: CreateCommDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communications.create(dossierId, dto, user);
  }
}

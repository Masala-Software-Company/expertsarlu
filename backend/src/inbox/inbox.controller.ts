import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { InboxService } from './inbox.service';
import { RequirePermission, RequireRole } from '../auth/decorators';

class StubMessageDto {
  @ApiProperty({ enum: ['EMAIL', 'WHATSAPP'] })
  @IsIn(['EMAIL', 'WHATSAPP'])
  canal!: 'EMAIL' | 'WHATSAPP';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  from!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sujet?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  corps!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dossierId?: string;
}

@ApiTags('inbox')
@ApiBearerAuth()
@Controller('inbox')
export class InboxController {
  constructor(private inbox: InboxService) {}

  @Get()
  @RequirePermission({ module: 'dossiers', action: 'read' })
  list(@Query('canal') canal?: string) {
    return this.inbox.list(canal);
  }

  /** Stub : simule une réception email / WhatsApp (à brancher plus tard sur un provider). */
  @Post('stub')
  @RequireRole('SUPER_ADMIN')
  stub(@Body() dto: StubMessageDto) {
    return this.inbox.receiveStub(dto);
  }

  @Post(':id/lier/:dossierId')
  @RequirePermission({ module: 'dossiers', action: 'update' })
  lier(@Param('id') id: string, @Param('dossierId') dossierId: string) {
    return this.inbox.lierAuDossier(id, dossierId);
  }
}

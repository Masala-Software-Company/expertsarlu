import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProspectStatut } from '@prisma/client';
import { ProspectsService } from './prospects.service';
import { RequirePermission } from '../auth/decorators';

class CreateProspectDto {
  @ApiProperty()
  @IsString()
  nom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prenom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class StatutDto {
  @ApiProperty({ enum: ProspectStatut })
  @IsEnum(ProspectStatut)
  statut!: ProspectStatut;
}

@ApiTags('prospects')
@ApiBearerAuth()
@Controller('prospects')
export class ProspectsController {
  constructor(private prospects: ProspectsService) {}

  @Get()
  @RequirePermission({ module: 'prospects', action: 'read' })
  list() {
    return this.prospects.list();
  }

  @Post()
  @RequirePermission({ module: 'prospects', action: 'create' })
  create(@Body() dto: CreateProspectDto) {
    return this.prospects.create(dto);
  }

  @Patch(':id/statut')
  @RequirePermission({ module: 'prospects', action: 'update' })
  statut(@Param('id') id: string, @Body() dto: StatutDto) {
    return this.prospects.updateStatut(id, dto.statut);
  }
}

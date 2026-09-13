import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StatutTache, TypeRendezVous, TypeTacheLogistique } from '@prisma/client';
import { LogistiqueService } from './logistique.service';
import { RequirePermission } from '../auth/decorators';

class CreateTacheDto {
  @ApiProperty({ enum: TypeTacheLogistique })
  @IsEnum(TypeTacheLogistique)
  type!: TypeTacheLogistique;

  @ApiProperty()
  @IsString()
  titre!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneAId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  echeance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class StatutDto {
  @ApiProperty({ enum: StatutTache })
  @IsEnum(StatutTache)
  statut!: StatutTache;
}

class CreateRdvDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dossierId?: string;

  @ApiProperty({ enum: TypeRendezVous })
  @IsEnum(TypeRendezVous)
  type!: TypeRendezVous;

  @ApiProperty()
  @IsString()
  dateHeure!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lieu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneAId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('logistique')
@ApiBearerAuth()
@Controller('logistique')
export class LogistiqueController {
  constructor(private logistique: LogistiqueService) {}

  @Get('taches/:dossierId')
  @RequirePermission({ module: 'logistique', action: 'read' })
  taches(@Param('dossierId') dossierId: string) {
    return this.logistique.listTaches(dossierId);
  }

  @Post('taches/:dossierId')
  @RequirePermission({ module: 'logistique', action: 'create' })
  createTache(@Param('dossierId') dossierId: string, @Body() dto: CreateTacheDto) {
    return this.logistique.createTache({ ...dto, dossierId });
  }

  @Patch('taches/:id/statut')
  @RequirePermission({ module: 'logistique', action: 'update' })
  statut(@Param('id') id: string, @Body() dto: StatutDto) {
    return this.logistique.updateStatut(id, dto.statut);
  }

  @Get('planning')
  @RequirePermission({ module: 'logistique', action: 'read' })
  planning(@Query('date') date?: string) {
    return this.logistique.planningDuJour(date ? new Date(date) : new Date());
  }

  @Post('rendez-vous')
  @RequirePermission({ module: 'logistique', action: 'create' })
  rdv(@Body() dto: CreateRdvDto) {
    return this.logistique.createRendezVous(dto);
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TypeLigneCotation } from '@prisma/client';
import { CotationService } from './cotation.service';
import { RequirePermission } from '../auth/decorators';

class RecalculDto {
  @ApiPropertyOptional({ description: 'Jours d’assurance voyage' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  joursAssurance?: number;
}

class LigneDto {
  @ApiProperty({ enum: TypeLigneCotation })
  @IsEnum(TypeLigneCotation)
  type!: TypeLigneCotation;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsNumber()
  montant!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  quantite?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  devise?: string;
}

@ApiTags('cotation')
@ApiBearerAuth()
@Controller('cotation')
export class CotationController {
  constructor(private cotation: CotationService) {}

  @Get(':dossierId')
  @RequirePermission({ module: 'cotation', action: 'read' })
  resume(@Param('dossierId') dossierId: string) {
    return this.cotation.resume(dossierId);
  }

  @Post(':dossierId/recalculer')
  @RequirePermission({ module: 'cotation', action: 'update' })
  recalculer(@Param('dossierId') dossierId: string, @Body() dto: RecalculDto) {
    return this.cotation.recalculer(dossierId, dto.joursAssurance);
  }

  @Post(':dossierId/lignes')
  @RequirePermission({ module: 'cotation', action: 'update' })
  ajouterLigne(@Param('dossierId') dossierId: string, @Body() dto: LigneDto) {
    return this.cotation.ajouterLigne(dossierId, dto);
  }
}

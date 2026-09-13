import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MethodePaiement } from '@prisma/client';
import { FacturationService } from './facturation.service';
import { RequirePermission } from '../auth/decorators';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

class PaiementDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  montant!: number;

  @ApiProperty({ enum: MethodePaiement })
  @IsEnum(MethodePaiement)
  methode!: MethodePaiement;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}

@ApiTags('facturation')
@ApiBearerAuth()
@Controller('facturation')
export class FacturationController {
  constructor(private facturation: FacturationService) {}

  @Post('devis/:dossierId')
  @RequirePermission({ module: 'facturation', action: 'create' })
  devis(@Param('dossierId') dossierId: string, @CurrentUser() user: AuthUser) {
    return this.facturation.creerDevis(dossierId, user);
  }

  @Get('dossier/:dossierId')
  @RequirePermission({ module: 'facturation', action: 'read' })
  list(@Param('dossierId') dossierId: string) {
    return this.facturation.listByDossier(dossierId);
  }

  @Post('paiements/:factureId')
  @RequirePermission({ module: 'facturation', action: 'create' })
  paiement(@Param('factureId') factureId: string, @Body() dto: PaiementDto) {
    return this.facturation.enregistrerPaiement(factureId, dto);
  }

  @Post('factures/:factureId/officielle')
  @RequirePermission({ module: 'facturation', action: 'create' })
  officielle(
    @Param('factureId') factureId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.facturation.genererFactureOfficielle(factureId, user);
  }
}

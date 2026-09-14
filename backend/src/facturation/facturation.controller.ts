import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { MethodePaiement } from '@prisma/client';
import type { Response } from 'express';
import { FacturationService } from './facturation.service';
import { Public, RequirePermission, RequireRole } from '../auth/decorators';
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

class SignerDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  nom!: string;
}

@ApiTags('facturation')
@ApiBearerAuth()
@Controller('facturation')
export class FacturationController {
  constructor(private facturation: FacturationService) {}

  @Get('pipeline')
  @RequireRole('SUPER_ADMIN')
  pipeline() {
    return this.facturation.pipelineFinancier();
  }

  @Get('caisse')
  @RequirePermission({ module: 'facturation', action: 'read' })
  caisse() {
    return this.facturation.fileCaisse();
  }

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

  @Post('factures/:factureId/regenerer-pdf')
  @RequirePermission({ module: 'facturation', action: 'create' })
  regenerer(@Param('factureId') factureId: string) {
    return this.facturation.regenererPdf(factureId);
  }

  @Get('factures/:factureId/pdf')
  @RequirePermission({ module: 'facturation', action: 'read' })
  async pdf(@Param('factureId') factureId: string, @Res() res: Response) {
    const opened = await this.facturation.getPdfStream(factureId);
    res.setHeader('Content-Type', opened.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="facture-${factureId}.pdf"`);
    opened.stream.pipe(res);
  }

  @Public()
  @Post('signer/:token')
  signer(@Param('token') token: string, @Body() dto: SignerDto) {
    return this.facturation.signerParToken(token, dto.nom);
  }

  @Public()
  @Get('signer/:token')
  signerInfo(@Param('token') token: string) {
    return this.facturation.infoSignature(token);
  }
}

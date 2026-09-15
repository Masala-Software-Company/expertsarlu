import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Res } from '@nestjs/common';
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

class MotifDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  motif!: string;
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

  @Get('demandes-suppression')
  @RequireRole('SUPER_ADMIN')
  demandesSuppression() {
    return this.facturation.listDemandesSuppression();
  }

  @Patch('demandes-suppression/:demandeId/approuver')
  @RequireRole('SUPER_ADMIN')
  approuverSuppression(
    @Param('demandeId') demandeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.facturation.approuverSuppression(demandeId, user);
  }

  @Patch('demandes-suppression/:demandeId/refuser')
  @RequireRole('SUPER_ADMIN')
  refuserSuppression(
    @Param('demandeId') demandeId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: { motif?: string },
  ) {
    return this.facturation.refuserSuppression(demandeId, user, dto.motif);
  }

  @Post('manuel/:dossierId')
  @RequirePermission({ module: 'facturation', action: 'create' })
  manuel(
    @Param('dossierId') dossierId: string,
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
      type?: 'FACTURE' | 'DEVIS';
      lignes: { code?: string; description: string; quantite?: number; montant: number }[];
    },
  ) {
    return this.facturation.creerFactureManuelle(dossierId, user, dto);
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

  @Post('regenerer-tous-pdfs')
  @RequireRole('SUPER_ADMIN')
  regenererTous() {
    return this.facturation.regenererTousLesPdfs();
  }

  @Get('factures/:factureId/pdf')
  @RequirePermission({ module: 'facturation', action: 'read' })
  async pdf(@Param('factureId') factureId: string, @Res() res: Response) {
    const { buffer, filename } = await this.facturation.getPdfBuffer(factureId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }

  @Delete('factures/:factureId')
  @RequireRole('SUPER_ADMIN')
  supprimer(
    @Param('factureId') factureId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.facturation.supprimerFacture(factureId, user);
  }

  @Post('factures/:factureId/demande-suppression')
  @RequirePermission({ module: 'facturation', action: 'create' })
  demandeSuppression(
    @Param('factureId') factureId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: MotifDto,
  ) {
    return this.facturation.demanderSuppression(factureId, user, dto.motif);
  }

  @Public()
  @Get('verifier/:code')
  async verifier(
    @Param('code') code: string,
    @Res() res: Response,
    @Query('format') format?: string,
    @Headers('accept') accept?: string,
  ) {
    const wantsJson =
      format === 'json' || (accept ?? '').includes('application/json');

    try {
      const data = await this.facturation.verifierParCode(code);
      if (wantsJson) {
        return res.json(data);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(this.facturation.renderVerifierHtml(data, code));
    } catch {
      if (wantsJson) {
        return res.status(404).json({
          message: 'Code de vérification invalide',
          error: 'Not Found',
          statusCode: 404,
        });
      }
      res.status(404);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(this.facturation.renderVerifierHtml(null, code));
    }
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

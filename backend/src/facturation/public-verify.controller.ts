import { Controller, Get, Headers, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/decorators';
import { FacturationService } from '../facturation/facturation.service';

/**
 * URL publique courte pour QR codes — hors préfixe /api
 * ex. https://votre-domaine.com/v/A1B2C3D4E5F6
 */
@ApiTags('verify')
@Controller('v')
export class PublicVerifyController {
  constructor(private facturation: FacturationService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':code')
  async verify(
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
        return res.json({
          valide: true,
          numero: data.numero,
          type: data.type,
          codeVerification: data.codeVerification,
          // Pas de montant / patient en JSON public — limite la fuite d’info
        });
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(this.facturation.renderVerifierHtml(data, code));
    } catch (e) {
      if (e instanceof NotFoundException || (e as { status?: number })?.status === 404) {
        if (wantsJson) {
          return res.status(404).json({ valide: false, message: 'Code invalide' });
        }
        res.status(404);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(this.facturation.renderVerifierHtml(null, code));
      }
      throw e;
    }
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PreInscriptionStatut, TypeClient } from '@prisma/client';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { Public, RequirePermission } from '../auth/decorators';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import {
  PreInscriptionsService,
  type PreInscriptionPayload,
} from './pre-inscriptions.service';

@ApiTags('pre-inscriptions')
@Controller()
export class PreInscriptionsController {
  constructor(private service: PreInscriptionsService) {}

  /** Institutions actives pour le sélecteur du portail public. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('public/institutions')
  institutionsPubliques() {
    return this.service.listInstitutionsPubliques();
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('public/pre-inscriptions')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        payload: { type: 'string', description: 'JSON PreInscriptionPayload' },
        photo: { type: 'string', format: 'binary' },
      },
      required: ['payload', 'photo'],
    },
  })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  soumettre(
    @UploadedFile() photo: Express.Multer.File,
    @Body('payload') payloadRaw: string,
    @Req() req: Request,
  ) {
    let payload: PreInscriptionPayload;
    try {
      payload = typeof payloadRaw === 'string' ? JSON.parse(payloadRaw) : payloadRaw;
    } catch {
      payload = {} as PreInscriptionPayload;
    }
    return this.service.soumettrePublic(payload, photo, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @ApiBearerAuth()
  @Get('pre-inscriptions')
  @RequirePermission({ module: 'pre_inscriptions', action: 'read' })
  list(
    @Query('q') q?: string,
    @Query('statut') statut?: PreInscriptionStatut,
    @Query('categorie') categorie?: TypeClient,
    @Query('partenaireId') partenaireId?: string,
  ) {
    return this.service.listInterne({ q, statut, categorie, partenaireId });
  }

  @ApiBearerAuth()
  @Get('pre-inscriptions/:id')
  @RequirePermission({ module: 'pre_inscriptions', action: 'read' })
  one(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @ApiBearerAuth()
  @Get('pre-inscriptions/:id/photo')
  @RequirePermission({ module: 'pre_inscriptions', action: 'read' })
  async photo(@Param('id') id: string, @Res() res: Response) {
    const opened = await this.service.photoStream(id);
    if (!opened) {
      res.status(404).json({ message: 'Photo introuvable' });
      return;
    }
    res.setHeader('Content-Type', opened.contentType || 'image/jpeg');
    opened.stream.pipe(res);
  }

  @ApiBearerAuth()
  @Get('pre-inscriptions/:id/doublons')
  @RequirePermission({ module: 'pre_inscriptions', action: 'read' })
  doublons(@Param('id') id: string) {
    return this.service.detectDoublons(id);
  }

  @ApiBearerAuth()
  @Patch('pre-inscriptions/:id/statut')
  @RequirePermission({ module: 'pre_inscriptions', action: 'update' })
  statut(
    @Param('id') id: string,
    @Body() body: { statut: PreInscriptionStatut; motif?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateStatut(id, body.statut, user, body.motif);
  }

  @ApiBearerAuth()
  @Post('pre-inscriptions/:id/creer-dossier')
  @RequirePermission({ module: 'pre_inscriptions', action: 'update' })
  creer(
    @Param('id') id: string,
    @Body()
    body: { forcerMalgreDoublon?: boolean; partenaireId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.creerDossier(id, user, body);
  }
}

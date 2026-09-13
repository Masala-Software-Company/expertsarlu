import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CategorieDocument } from '@prisma/client';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { GedService } from './ged.service';
import { RequirePermission } from '../auth/decorators';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@ApiTags('ged')
@ApiBearerAuth()
@Controller('ged')
export class GedController {
  constructor(private ged: GedService) {}

  @Get('file/:docId')
  @RequirePermission({ module: 'ged', action: 'read' })
  async download(@Param('docId') docId: string, @Res() res: Response) {
    const doc = await this.ged.getFile(docId);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.nomFichier)}"`,
    );
    createReadStream(doc.cheminStockage).pipe(res);
  }

  @Delete('file/:docId')
  @RequirePermission({ module: 'ged', action: 'delete' })
  remove(@Param('docId') docId: string, @CurrentUser() user: AuthUser) {
    return this.ged.remove(docId, user);
  }

  @Get(':dossierId')
  @RequirePermission({ module: 'ged', action: 'read' })
  list(@Param('dossierId') dossierId: string) {
    return this.ged.list(dossierId);
  }

  @Post(':dossierId')
  @RequirePermission({ module: 'ged', action: 'create' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        categorie: { type: 'string', enum: Object.values(CategorieDocument) },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('dossierId') dossierId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('categorie') categorie: CategorieDocument = 'AUTRE',
    @CurrentUser() user: AuthUser,
  ) {
    return this.ged.upload(dossierId, file, categorie ?? 'AUTRE', user);
  }
}

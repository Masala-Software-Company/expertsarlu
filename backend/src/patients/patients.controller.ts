import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { PatientsService } from './patients.service';
import { RequirePermission } from '../auth/decorators';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private patients: PatientsService) {}

  @Post(':id/photo')
  @RequirePermission({ module: 'dossiers', action: 'update' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.patients.uploadPhoto(id, file);
  }

  @Get(':id/photo')
  @RequirePermission({ module: 'dossiers', action: 'read' })
  async getPhoto(@Param('id') id: string, @Res() res: Response) {
    const meta = await this.patients.getPhoto(id);
    if (!meta) throw new NotFoundException('Photo introuvable');
    res.setHeader('Content-Type', meta.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    meta.stream.pipe(res);
  }
}

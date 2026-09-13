import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CategorieDocument } from '@prisma/client';
import { GedService } from './ged.service';
import { RequirePermission } from '../auth/decorators';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@ApiTags('ged')
@ApiBearerAuth()
@Controller('ged')
export class GedController {
  constructor(private ged: GedService) {}

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
    return this.ged.upload(dossierId, file, categorie, user);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { Response } from 'express';
import { Priorite, TypeClient } from '@prisma/client';
import { Public } from '../auth/decorators';
import { ClientPortalService } from './client-portal.service';
import { DossiersService } from '../dossiers/dossiers.service';
import { StorageService } from '../storage/storage.service';

class ClientInscriptionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  nom!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  prenom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationalite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  numeroPasseport?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateNaissance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adresse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pathologie?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({ enum: TypeClient })
  @IsOptional()
  @IsEnum(TypeClient)
  typeClient?: TypeClient;

  @ApiPropertyOptional({ enum: Priorite })
  @IsOptional()
  @IsEnum(Priorite)
  priorite?: Priorite;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('client-portal')
@Controller('client')
export class ClientPortalController {
  constructor(
    private portal: ClientPortalService,
    private dossiers: DossiersService,
    private storage: StorageService,
  ) {}

  @Public()
  @Get('suivi/:token')
  suivi(@Param('token') token: string) {
    return this.dossiers.getBySuiviToken(token);
  }

  @Public()
  @Get('suivi/:token/photo')
  async suiviPhoto(@Param('token') token: string, @Res() res: Response) {
    const ref = await this.dossiers.getSuiviPhoto(token);
    if (!ref) throw new NotFoundException('Photo introuvable');
    const opened = await this.storage.open(ref);
    if (!opened) throw new NotFoundException('Photo introuvable');
    const lower = ref.toLowerCase();
    const mime = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=300');
    opened.stream.pipe(res);
  }

  @Public()
  @Post('inscription')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        nom: { type: 'string' },
        prenom: { type: 'string' },
        email: { type: 'string' },
        telephone: { type: 'string' },
        nationalite: { type: 'string' },
        numeroPasseport: { type: 'string' },
        dateNaissance: { type: 'string' },
        adresse: { type: 'string' },
        pathologie: { type: 'string' },
        destination: { type: 'string' },
        typeClient: { type: 'string', enum: Object.values(TypeClient) },
        priorite: { type: 'string', enum: Object.values(Priorite) },
        notes: { type: 'string' },
        photo: { type: 'string', format: 'binary' },
        passeport: { type: 'string', format: 'binary' },
      },
      required: ['nom', 'prenom'],
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'photo', maxCount: 1 },
      { name: 'passeport', maxCount: 1 },
    ]),
  )
  inscription(
    @Body() dto: ClientInscriptionDto,
    @UploadedFiles()
    files: { photo?: Express.Multer.File[]; passeport?: Express.Multer.File[] },
  ) {
    if (!dto.nom?.trim() || !dto.prenom?.trim()) {
      throw new BadRequestException('Nom et prénom requis');
    }
    return this.portal.inscrire(dto, {
      photo: files?.photo?.[0],
      passeport: files?.passeport?.[0],
    });
  }
}

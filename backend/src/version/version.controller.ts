import { Controller, Get, NotFoundException, Res, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const MAC_KEY = 'releases/eXpert-mac.dmg';
const WIN_KEY = 'releases/eXpert-win.exe';

@ApiTags('version')
@Controller('version')
export class VersionController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private storage: StorageService,
  ) {}

  private publicApiBase() {
    return (
      this.config.get<string>('PUBLIC_API_BASE_URL') ||
      'https://expertsarlu-production.up.railway.app/api'
    ).replace(/\/$/, '');
  }

  @Public()
  @Get('latest')
  async latest() {
    const row = await this.prisma.appVersion.findFirst({
      where: { actif: true },
      orderBy: { creeLe: 'desc' },
    });

    const api = this.publicApiBase();
    const downloadUrlMac =
      row?.downloadUrlMac ||
      this.config.get<string>('DOWNLOAD_MAC_URL') ||
      `${api}/version/download/mac`;

    const downloadUrlWin =
      row?.downloadUrlWin ||
      this.config.get<string>('DOWNLOAD_WIN_URL') ||
      `${api}/version/download/win`;

    const pageUrl =
      row?.driveUrl || this.config.get('DRIVE_DOWNLOAD_URL') || undefined;

    return {
      version: row?.version ?? this.config.get('APP_VERSION', '1.0.0'),
      changelog:
        row?.changelog ??
        'Nouvelle version eXpert disponible. Cliquez sur Mettre à jour.',
      driveUrl: pageUrl,
      downloadUrl: downloadUrlMac || downloadUrlWin || pageUrl,
      downloadUrlMac,
      downloadUrlWin,
      releasesUrl: pageUrl,
      source: row ? 'database' : 'config',
    };
  }

  @Public()
  @Get('download/mac')
  async downloadMac(@Res({ passthrough: true }) res: Response) {
    const external = this.config.get<string>('DOWNLOAD_MAC_URL');
    if (external) {
      res.redirect(302, external);
      return;
    }
    return this.streamInstaller(MAC_KEY, 'eXpert-mac.dmg', 'application/x-apple-diskimage', res);
  }

  @Public()
  @Get('download/win')
  async downloadWin(@Res({ passthrough: true }) res: Response) {
    const external = this.config.get<string>('DOWNLOAD_WIN_URL');
    if (external) {
      res.redirect(302, external);
      return;
    }
    return this.streamInstaller(
      WIN_KEY,
      'eXpert-windows-setup.exe',
      'application/octet-stream',
      res,
    );
  }

  private async streamInstaller(
    key: string,
    filename: string,
    contentType: string,
    res: Response,
  ) {
    const opened = await this.storage.open(`s3:${key}`);
    if (!opened) {
      throw new NotFoundException(
        `Installateur indisponible (${filename}). Réessayez après publication.`,
      );
    }
    res.setHeader('Content-Type', opened.contentType || contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(opened.stream);
  }
}

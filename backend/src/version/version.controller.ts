import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('version')
@Controller('version')
export class VersionController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Public()
  @Get('latest')
  async latest() {
    const row = await this.prisma.appVersion.findFirst({
      where: { actif: true },
      orderBy: { creeLe: 'desc' },
    });

    const downloadUrlMac =
      row?.downloadUrlMac ||
      this.config.get<string>('DOWNLOAD_MAC_URL') ||
      undefined;

    const downloadUrlWin =
      row?.downloadUrlWin ||
      this.config.get<string>('DOWNLOAD_WIN_URL') ||
      undefined;

    const pageUrl =
      row?.driveUrl || this.config.get('DRIVE_DOWNLOAD_URL') || undefined;

    return {
      version: row?.version ?? this.config.get('APP_VERSION', '1.0.0'),
      changelog:
        row?.changelog ??
        'Installateurs desktop eXpert (macOS .dmg / Windows .exe)',
      driveUrl: pageUrl,
      downloadUrl: downloadUrlMac || downloadUrlWin || pageUrl,
      downloadUrlMac,
      downloadUrlWin,
      releasesUrl: pageUrl,
      source: row ? 'database' : 'config',
    };
  }
}

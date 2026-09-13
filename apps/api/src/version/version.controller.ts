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

    return {
      version: row?.version ?? this.config.get('APP_VERSION', '1.0.0'),
      changelog: row?.changelog ?? 'Version initiale',
      driveUrl:
        row?.driveUrl ??
        this.config.get(
          'DRIVE_DOWNLOAD_URL',
          'https://drive.google.com/drive/folders/REPLACE_WITH_SHARED_FOLDER_ID',
        ),
    };
  }
}

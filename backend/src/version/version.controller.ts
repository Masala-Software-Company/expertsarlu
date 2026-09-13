import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsString, Matches } from 'class-validator';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

class PublishVersionDto {
  @ApiProperty({ example: '1.0.2' })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+/)
  version!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changelog?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  downloadUrl?: string;
}

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

    const githubRepo = this.config.get<string>('GITHUB_REPO');
    let githubDownloadUrl: string | undefined;
    let githubVersion: string | undefined;

    if (githubRepo) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${githubRepo}/releases/latest`,
          {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'expert-sarlu',
            },
          },
        );
        if (res.ok) {
          const json = (await res.json()) as {
            tag_name?: string;
            html_url?: string;
            assets?: { name: string; browser_download_url: string }[];
          };
          githubVersion = json.tag_name?.replace(/^v/, '');
          githubDownloadUrl =
            json.assets?.find((a) => a.name.endsWith('.dmg'))?.browser_download_url ??
            json.html_url;
        }
      } catch {
        /* ignore network */
      }
    }

    const version =
      row?.version ??
      githubVersion ??
      this.config.get('APP_VERSION', '1.0.0');

    return {
      version,
      changelog: row?.changelog ?? 'Mise à jour eXpert disponible',
      driveUrl:
        row?.driveUrl ??
        githubDownloadUrl ??
        this.config.get('DRIVE_DOWNLOAD_URL'),
      downloadUrl:
        row?.driveUrl ??
        githubDownloadUrl ??
        this.config.get('DRIVE_DOWNLOAD_URL'),
      source: row ? 'database' : githubVersion ? 'github' : 'config',
    };
  }

  /** Appelé par GitHub Actions après un build desktop (header X-Release-Secret). */
  @Public()
  @Post('publish')
  async publish(
    @Headers('x-release-secret') secret: string | undefined,
    @Body() dto: PublishVersionDto,
  ) {
    const expected = this.config.get<string>('RELEASE_SECRET');
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Secret de publication invalide');
    }

    await this.prisma.appVersion.updateMany({ data: { actif: false } });
    const row = await this.prisma.appVersion.create({
      data: {
        version: dto.version,
        changelog: dto.changelog ?? `Release desktop ${dto.version}`,
        driveUrl: dto.downloadUrl ?? this.config.get('DRIVE_DOWNLOAD_URL'),
        actif: true,
      },
    });

    return { ok: true, version: row.version, downloadUrl: row.driveUrl };
  }
}

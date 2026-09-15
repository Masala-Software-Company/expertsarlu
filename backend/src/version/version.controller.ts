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

  @ApiPropertyOptional({ description: 'Page release ou lien générique' })
  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @ApiPropertyOptional({ description: 'Lien direct .dmg macOS' })
  @IsOptional()
  @IsString()
  downloadUrlMac?: string;

  @ApiPropertyOptional({ description: 'Lien direct .exe Windows' })
  @IsOptional()
  @IsString()
  downloadUrlWin?: string;
}

type GithubAsset = { name: string; browser_download_url: string };

@ApiTags('version')
@Controller('version')
export class VersionController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private async fetchGithubLatest(): Promise<{
    version?: string;
    pageUrl?: string;
    macUrl?: string;
    winUrl?: string;
  }> {
    const githubRepo = this.config.get<string>('GITHUB_REPO');
    if (!githubRepo) return {};
    try {
      const res = await fetch(
        `https://api.github.com/repos/${githubRepo}/releases/latest`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'expert-sarlu',
            ...(this.config.get('GITHUB_TOKEN')
              ? { Authorization: `Bearer ${this.config.get('GITHUB_TOKEN')}` }
              : {}),
          },
        },
      );
      if (!res.ok) return {};
      const json = (await res.json()) as {
        tag_name?: string;
        html_url?: string;
        assets?: GithubAsset[];
      };
      const assets = json.assets ?? [];
      const macUrl =
        assets.find((a) => /\.dmg$/i.test(a.name))?.browser_download_url ??
        undefined;
      const winUrl =
        assets.find((a) => /\.exe$/i.test(a.name))?.browser_download_url ??
        assets.find((a) => /\.msi$/i.test(a.name))?.browser_download_url ??
        undefined;
      return {
        version: json.tag_name?.replace(/^v/, ''),
        pageUrl: json.html_url,
        macUrl,
        winUrl,
      };
    } catch {
      return {};
    }
  }

  @Public()
  @Get('latest')
  async latest() {
    const row = await this.prisma.appVersion.findFirst({
      where: { actif: true },
      orderBy: { creeLe: 'desc' },
    });
    const gh = await this.fetchGithubLatest();

    const downloadUrlMac =
      row?.downloadUrlMac ||
      this.config.get<string>('DOWNLOAD_MAC_URL') ||
      gh.macUrl ||
      undefined;

    const downloadUrlWin =
      row?.downloadUrlWin ||
      this.config.get<string>('DOWNLOAD_WIN_URL') ||
      gh.winUrl ||
      undefined;

    const pageUrl =
      row?.driveUrl ||
      gh.pageUrl ||
      this.config.get('DRIVE_DOWNLOAD_URL') ||
      undefined;

    const version =
      row?.version ??
      gh.version ??
      this.config.get('APP_VERSION', '1.0.0');

    return {
      version,
      changelog:
        row?.changelog ??
        'Installateurs desktop eXpert (macOS .dmg / Windows .exe)',
      driveUrl: pageUrl,
      downloadUrl: downloadUrlMac || downloadUrlWin || pageUrl,
      downloadUrlMac,
      downloadUrlWin,
      releasesUrl: pageUrl,
      source: row ? 'database' : gh.version ? 'github' : 'config',
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
        downloadUrlMac: dto.downloadUrlMac,
        downloadUrlWin: dto.downloadUrlWin,
        actif: true,
      },
    });

    return {
      ok: true,
      version: row.version,
      downloadUrl: row.driveUrl,
      downloadUrlMac: row.downloadUrlMac,
      downloadUrlWin: row.downloadUrlWin,
    };
  }
}

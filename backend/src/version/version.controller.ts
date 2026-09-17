import { Controller, Get, NotFoundException, Res, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const MAC_KEY = 'releases/eXpert-mac.dmg';
const WIN_KEY = 'releases/eXpert-win.exe';
/** Bundles Tauri updater (signés) */
const MAC_UPDATE_KEY = 'releases/eXpert.app.tar.gz';
const WIN_UPDATE_KEY = 'releases/eXpert-setup.exe';

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

  private isNewer(remote: string, local: string) {
    const a = remote.replace(/^v/, '').split('.').map(Number);
    const b = local.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] ?? 0;
      const y = b[i] ?? 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return false;
  }

  @Public()
  @Get('latest')
  async latest() {
    const row = await this.prisma.appVersion.findFirst({
      where: { actif: true },
      orderBy: { creeLe: 'desc' },
    });

    const api = this.publicApiBase();
    const stableMac = `${api}/version/download/mac`;
    const stableWin = `${api}/version/download/win`;

    const downloadUrlMac = stableMac;
    const downloadUrlWin = stableWin;

    const pageUrl =
      row?.driveUrl || this.config.get('DRIVE_DOWNLOAD_URL') || undefined;

    const configVersion = this.config.get<string>('APP_VERSION', '1.0.5') ?? '1.0.5';
    const FORCE_MIN = '1.0.5';
    const dbVersion = row?.version ?? '0.0.0';
    let version = dbVersion;
    if (this.isNewer(configVersion, version)) version = configVersion;
    if (this.isNewer(FORCE_MIN, version)) version = FORCE_MIN;

    const changelog =
      'Mise à jour silencieuse eXpert — installation automatique au redémarrage.';

    if (this.isNewer(version, dbVersion) || !row?.actif) {
      await this.prisma.appVersion.updateMany({ data: { actif: false } });
      await this.prisma.appVersion.upsert({
        where: { version },
        create: {
          version,
          changelog,
          downloadUrlMac: stableMac,
          downloadUrlWin: stableWin,
          driveUrl: pageUrl,
          actif: true,
        },
        update: {
          actif: true,
          downloadUrlMac: stableMac,
          downloadUrlWin: stableWin,
          changelog,
        },
      });
    } else if (row) {
      if (
        row.downloadUrlMac !== stableMac ||
        row.downloadUrlWin !== stableWin
      ) {
        await this.prisma.appVersion.update({
          where: { id: row.id },
          data: { downloadUrlMac: stableMac, downloadUrlWin: stableWin, changelog },
        });
      }
    }

    return {
      version,
      changelog,
      driveUrl: pageUrl,
      downloadUrl: downloadUrlMac || downloadUrlWin || pageUrl,
      downloadUrlMac,
      downloadUrlWin,
      releasesUrl: pageUrl,
      silentUpdate: true,
      source: row ? 'database' : 'config',
    };
  }

  /**
   * Manifest Tauri updater — format officiel latest.json
   * https://v2.tauri.app/plugin/updater/
   */
  @Public()
  @Get('tauri-update')
  async tauriUpdate() {
    const row = await this.prisma.appVersion.findFirst({
      where: { actif: true },
      orderBy: { creeLe: 'desc' },
    });
    if (!row) {
      throw new NotFoundException('Aucune version publiée');
    }

    const api = this.publicApiBase();
    const macUrl = `${api}/version/download/mac-update`;
    const winUrl = `${api}/version/download/win-update`;
    const macSig = row.updaterMacSig?.trim();
    const winSig = row.updaterWinSig?.trim();

    const platforms: Record<string, { signature: string; url: string }> = {};
    if (macSig) {
      platforms['darwin-x86_64'] = { signature: macSig, url: macUrl };
      platforms['darwin-aarch64'] = { signature: macSig, url: macUrl };
    }
    if (winSig) {
      platforms['windows-x86_64'] = { signature: winSig, url: winUrl };
    }

    if (!Object.keys(platforms).length) {
      throw new NotFoundException(
        'Bundles updater non publiés — installez la version manuelle une dernière fois.',
      );
    }

    return {
      version: row.version,
      notes: row.changelog ?? 'Mise à jour eXpert',
      pub_date: row.creeLe.toISOString(),
      platforms,
    };
  }

  /** Ignore les URLs S3 signées / temporaires — préférer le proxy API stable. */
  private pickStableUrl(url?: string | null) {
    if (!url?.trim()) return undefined;
    const u = url.trim();
    if (
      u.includes('X-Amz-') ||
      u.includes('Signature=') ||
      u.includes('storageapi.dev') ||
      u.includes('amazonaws.com')
    ) {
      return undefined;
    }
    return u;
  }

  @Public()
  @Get('download/mac')
  async downloadMac(@Res({ passthrough: true }) res: Response) {
    const external = this.pickStableUrl(this.config.get<string>('DOWNLOAD_MAC_URL'));
    if (external) {
      res.redirect(302, external);
      return;
    }
    return this.streamInstaller(MAC_KEY, 'eXpert-mac.dmg', 'application/x-apple-diskimage', res);
  }

  @Public()
  @Get('download/win')
  async downloadWin(@Res({ passthrough: true }) res: Response) {
    const external = this.pickStableUrl(this.config.get<string>('DOWNLOAD_WIN_URL'));
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

  @Public()
  @Get('download/mac-update')
  async downloadMacUpdate(@Res({ passthrough: true }) res: Response) {
    return this.streamInstaller(
      MAC_UPDATE_KEY,
      'eXpert.app.tar.gz',
      'application/gzip',
      res,
    );
  }

  @Public()
  @Get('download/win-update')
  async downloadWinUpdate(@Res({ passthrough: true }) res: Response) {
    return this.streamInstaller(
      WIN_UPDATE_KEY,
      'eXpert-setup.exe',
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

import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MailService } from '../mail/mail.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private mail: MailService,
  ) {}

  @Public()
  @Get('health')
  async health() {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      storage: this.storage.enabled() ? 's3' : 'local',
      mail: this.mail.enabled() ? 'resend' : 'off',
      version: process.env.APP_VERSION ?? '1.0.0',
    };
  }
}

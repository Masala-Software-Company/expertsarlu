import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up', version: process.env.APP_VERSION ?? '1.0.0' };
    } catch {
      return { status: 'degraded', db: 'down', version: process.env.APP_VERSION ?? '1.0.0' };
    }
  }
}

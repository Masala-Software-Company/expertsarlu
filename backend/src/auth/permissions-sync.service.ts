import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPermissionRows } from './permissions.matrix';

/** Réapplique la matrice RBAC au démarrage (sans toucher aux utilisateurs). */
@Injectable()
export class PermissionsSyncService implements OnModuleInit {
  private readonly log = new Logger(PermissionsSyncService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.SYNC_PERMISSIONS_ON_BOOT === '0') return;
    const rows = buildPermissionRows();
    await this.prisma.permission.deleteMany();
    await this.prisma.permission.createMany({ data: rows });
    this.log.log(`Permissions synchronisées (${rows.length} lignes)`);
  }
}

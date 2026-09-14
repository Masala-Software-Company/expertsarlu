import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * After schema evolution, Railway may still run an older Prisma client that
 * inserts partenaires without maj_le. Ensure DB defaults + backfill so creates
 * never fail with NOT NULL on maj_le / nom_normalise.
 */
@Injectable()
export class PartenairesMigrationService implements OnModuleInit {
  private readonly log = new Logger(PartenairesMigrationService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE partenaires
          ALTER COLUMN maj_le SET DEFAULT CURRENT_TIMESTAMP
      `);
      await this.prisma.$executeRawUnsafe(`
        UPDATE partenaires
        SET maj_le = COALESCE(maj_le, cree_le, CURRENT_TIMESTAMP)
        WHERE maj_le IS NULL
      `);
    } catch (e) {
      this.log.warn(`Skip maj_le default: ${(e as Error).message}`);
    }

    try {
      const rows = await this.prisma.$queryRaw<{ id: string; nom: string }[]>`
        SELECT id, nom FROM partenaires WHERE nom_normalise IS NULL OR nom_normalise = ''
      `;
      for (const row of rows) {
        const base = row.nom
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
        let candidate = base || `partenaire-${row.id.slice(-6)}`;
        let n = 1;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            await this.prisma.$executeRaw`
              UPDATE partenaires SET nom_normalise = ${candidate}, actif = COALESCE(actif, true)
              WHERE id = ${row.id}
            `;
            break;
          } catch {
            n += 1;
            candidate = `${base}-${n}`;
          }
        }
      }
      if (rows.length) this.log.log(`Partenaires normalisés: ${rows.length}`);
    } catch (e) {
      this.log.warn(`Skip partenaires backfill: ${(e as Error).message}`);
    }
  }
}

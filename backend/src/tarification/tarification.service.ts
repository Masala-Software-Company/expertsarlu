import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class TarificationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  list() {
    return this.prisma.tarifBase.findMany({ orderBy: { libelle: 'asc' } });
  }

  async create(
    data: {
      libelle: string;
      cle: string;
      reference?: string;
      montant: number;
      unite?: string;
    },
    user: AuthUser,
  ) {
    const cle = data.cle.trim();
    const exists = await this.prisma.tarifBase.findUnique({ where: { cle } });
    if (exists) throw new ConflictException('Cette clé de tarif existe déjà');

    const created = await this.prisma.tarifBase.create({
      data: {
        cle,
        libelle: data.libelle.trim(),
        reference: data.reference?.trim() || cle.toUpperCase(),
        montant: data.montant,
        unite: data.unite?.trim() || null,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'CREATE',
      tableCible: 'tarifs_base',
      recordId: created.id,
      nouvelleValeur: { libelle: created.libelle, reference: created.reference },
    });

    return created;
  }

  async update(cle: string, montant: number, user: AuthUser) {
    const existing = await this.prisma.tarifBase.findUnique({ where: { cle } });
    if (!existing) throw new NotFoundException(`Tarif introuvable`);

    const updated = await this.prisma.tarifBase.update({
      where: { cle },
      data: { montant },
    });

    await this.audit.log({
      userId: user.id,
      action: 'UPDATE_TARIF',
      tableCible: 'tarifs_base',
      recordId: updated.id,
      ancienneValeur: { montant: Number(existing.montant) },
      nouvelleValeur: { montant, libelle: existing.libelle },
    });

    return updated;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
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
    return this.prisma.tarifBase.findMany({ orderBy: { cle: 'asc' } });
  }

  async update(cle: string, montant: number, user: AuthUser) {
    const existing = await this.prisma.tarifBase.findUnique({ where: { cle } });
    if (!existing) throw new NotFoundException(`Tarif ${cle} introuvable`);

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
      nouvelleValeur: { montant },
    });

    return updated;
  }
}

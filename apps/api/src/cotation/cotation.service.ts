import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Règle métier assurance voyage :
 * - J ≤ 30  → J × 7.00 USD
 * - J ≥ 31  → J × 6.50 USD
 */
export function calculerAssurance(jours: number): {
  jours: number;
  tarifApplique: number;
  montantTotal: number;
} {
  if (!Number.isFinite(jours) || jours < 1) {
    throw new Error('Le nombre de jours doit être ≥ 1');
  }
  const tarifApplique = jours <= 30 ? 7 : 6.5;
  const montantTotal = Number((jours * tarifApplique).toFixed(2));
  return { jours, tarifApplique, montantTotal };
}

@Injectable()
export class CotationService {
  constructor(private prisma: PrismaService) {}

  async getTarifs() {
    return this.prisma.tarifBase.findMany({ orderBy: { cle: 'asc' } });
  }

  async recalculer(dossierId: string, joursAssurance?: number) {
    const tarifs = await this.getTarifs();
    const byKey = Object.fromEntries(tarifs.map((t) => [t.cle, Number(t.montant)]));

    const dossier = await this.prisma.dossier.findUniqueOrThrow({
      where: { id: dossierId },
      include: { accompagnateurs: true, lignesCotation: true },
    });

    const lignes: Prisma.LigneCotationCreateManyInput[] = [];

    const nbAcc = dossier.accompagnateurs.length;
    if (nbAcc > 0) {
      const unit = byKey['accompagnateur'] ?? 350;
      lignes.push({
        dossierId,
        type: 'ACCOMPAGNATEUR',
        description: `Accompagnateur × ${nbAcc}`,
        montant: unit * nbAcc,
        quantite: nbAcc,
        devise: 'USD',
      });
    }

    if (joursAssurance && joursAssurance > 0) {
      const calc = calculerAssurance(joursAssurance);
      await this.prisma.calculAssurance.upsert({
        where: { dossierId },
        create: {
          dossierId,
          jours: calc.jours,
          tarifApplique: calc.tarifApplique,
          montantTotal: calc.montantTotal,
        },
        update: {
          jours: calc.jours,
          tarifApplique: calc.tarifApplique,
          montantTotal: calc.montantTotal,
        },
      });
      lignes.push({
        dossierId,
        type: 'ASSURANCE',
        description: `Assurance voyage ${calc.jours} j × ${calc.tarifApplique}$`,
        montant: calc.montantTotal,
        quantite: calc.jours,
        devise: 'USD',
      });
    }

    // Conserve les lignes manuelles (navette, forfait, etc.) déjà saisies hors auto
    const autoTypes = new Set(['ACCOMPAGNATEUR', 'ASSURANCE']);
    await this.prisma.ligneCotation.deleteMany({
      where: { dossierId, type: { in: [...autoTypes] as never } },
    });
    if (lignes.length) {
      await this.prisma.ligneCotation.createMany({ data: lignes });
    }

    return this.resume(dossierId);
  }

  async ajouterLigne(
    dossierId: string,
    data: {
      type: string;
      description: string;
      montant: number;
      quantite?: number;
      devise?: string;
    },
  ) {
    await this.prisma.ligneCotation.create({
      data: {
        dossierId,
        type: data.type as never,
        description: data.description,
        montant: data.montant,
        quantite: data.quantite ?? 1,
        devise: data.devise ?? 'USD',
      },
    });
    return this.resume(dossierId);
  }

  async resume(dossierId: string) {
    const lignes = await this.prisma.ligneCotation.findMany({
      where: { dossierId },
      orderBy: { creeLe: 'asc' },
    });
    const assurance = await this.prisma.calculAssurance.findUnique({
      where: { dossierId },
    });
    const total = lignes.reduce((s, l) => s + Number(l.montant), 0);
    return {
      lignes,
      assurance,
      total: Number(total.toFixed(2)),
      devise: 'USD',
    };
  }
}

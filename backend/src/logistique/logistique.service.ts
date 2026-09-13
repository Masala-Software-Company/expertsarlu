import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutTache, TypeRendezVous, TypeTacheLogistique } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LogistiqueService {
  constructor(private prisma: PrismaService) {}

  listTaches(dossierId: string) {
    return this.prisma.tacheLogistique.findMany({
      where: { dossierId },
      include: { assigneA: { select: { id: true, nom: true } } },
      orderBy: { creeLe: 'desc' },
    });
  }

  createTache(data: {
    dossierId: string;
    type: TypeTacheLogistique;
    titre: string;
    assigneAId?: string;
    echeance?: string;
    notes?: string;
  }) {
    return this.prisma.tacheLogistique.create({
      data: {
        dossierId: data.dossierId,
        type: data.type,
        titre: data.titre,
        assigneAId: data.assigneAId,
        echeance: data.echeance ? new Date(data.echeance) : undefined,
        notes: data.notes,
      },
    });
  }

  async updateStatut(id: string, statut: StatutTache) {
    const tache = await this.prisma.tacheLogistique.findUnique({ where: { id } });
    if (!tache) throw new NotFoundException();
    const historique = Array.isArray(tache.historique)
      ? (tache.historique as Prisma.JsonArray)
      : [];
    return this.prisma.tacheLogistique.update({
      where: { id },
      data: {
        statut,
        historique: [
          ...historique,
          { statut, at: new Date().toISOString() },
        ] as Prisma.InputJsonValue,
      },
    });
  }

  planningDuJour(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return this.prisma.rendezVous.findMany({
      where: { dateHeure: { gte: start, lte: end } },
      include: {
        dossier: { select: { id: true, numero: true, patient: true } },
        assigneA: { select: { id: true, nom: true } },
      },
      orderBy: { dateHeure: 'asc' },
    });
  }

  createRendezVous(data: {
    dossierId?: string;
    type: TypeRendezVous;
    dateHeure: string;
    lieu?: string;
    assigneAId?: string;
    notes?: string;
  }) {
    return this.prisma.rendezVous.create({
      data: {
        dossierId: data.dossierId,
        type: data.type,
        dateHeure: new Date(data.dateHeure),
        lieu: data.lieu,
        assigneAId: data.assigneAId,
        notes: data.notes,
      },
    });
  }
}

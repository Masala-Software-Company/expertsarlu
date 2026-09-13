import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class CommunicationsService {
  constructor(private prisma: PrismaService) {}

  list(dossierId: string) {
    return this.prisma.communication.findMany({
      where: { dossierId },
      orderBy: { creeLe: 'desc' },
    });
  }

  async create(
    dossierId: string,
    data: {
      canal: string;
      sens?: string;
      sujet?: string;
      corps: string;
    },
    user: AuthUser,
  ) {
    const dossier = await this.prisma.dossier.findUnique({ where: { id: dossierId } });
    if (!dossier) throw new NotFoundException();

    // Stub canaux externes : on journalise uniquement (pas d'envoi réel)
    return this.prisma.communication.create({
      data: {
        dossierId,
        canal: data.canal,
        sens: data.sens ?? 'SORTANT',
        sujet: data.sujet,
        corps: data.corps,
        auteurId: user.id,
        auteurNom: user.nom,
      },
    });
  }
}

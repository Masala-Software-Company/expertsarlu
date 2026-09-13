import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InboxService {
  constructor(private prisma: PrismaService) {}

  list(canal?: string) {
    return this.prisma.inboxMessage.findMany({
      where: canal ? { canal } : undefined,
      orderBy: { creeLe: 'desc' },
      take: 100,
    });
  }

  receiveStub(data: {
    canal: 'EMAIL' | 'WHATSAPP';
    from: string;
    sujet?: string;
    corps: string;
    dossierId?: string;
  }) {
    return this.prisma.inboxMessage.create({
      data: {
        canal: data.canal,
        fromAddr: data.from,
        sujet: data.sujet,
        corps: data.corps,
        dossierId: data.dossierId,
      },
    });
  }

  async lierAuDossier(id: string, dossierId: string) {
    const msg = await this.prisma.inboxMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException();
    const dossier = await this.prisma.dossier.findUnique({ where: { id: dossierId } });
    if (!dossier) throw new NotFoundException('Dossier introuvable');

    await this.prisma.communication.create({
      data: {
        dossierId,
        canal: msg.canal,
        sens: 'ENTRANT',
        sujet: msg.sujet ?? `Message ${msg.canal} de ${msg.fromAddr}`,
        corps: msg.corps,
        auteurNom: msg.fromAddr,
      },
    });

    return this.prisma.inboxMessage.update({
      where: { id },
      data: { dossierId, lu: true },
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class JobsService {
  private readonly log = new Logger(JobsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Purge définitive des dossiers en corbeille depuis plus de 90 jours. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeCorbeille90j() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const aPurger = await this.prisma.dossier.findMany({
      where: {
        statut: 'ARCHIVE_SUPPRIME',
        OR: [
          { supprimeLe: { lte: cutoff } },
          { AND: [{ supprimeLe: null }, { majLe: { lte: cutoff } }] },
        ],
      },
      select: { id: true, numero: true },
    });

    if (!aPurger.length) {
      this.log.debug('Purge corbeille : rien à supprimer');
      return { deleted: 0 };
    }

    const ids = aPurger.map((d) => d.id);
    await this.prisma.dossier.deleteMany({ where: { id: { in: ids } } });

    const admins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', actif: true },
      select: { id: true },
    });
    for (const admin of admins) {
      await this.notifications.create(
        admin.id,
        'PURGE_CORBEILLE',
        `${aPurger.length} dossier(s) purgés définitivement (>90 j)`,
        { numeros: aPurger.map((d) => d.numero) },
      );
    }

    this.log.log(`Purge corbeille : ${aPurger.length} dossier(s)`);
    return { deleted: aPurger.length };
  }

  /** Rappel devis non signés / non payés depuis 7 jours */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async rappelDevisEnAttente() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const devis = await this.prisma.facture.findMany({
      where: {
        type: 'DEVIS',
        statut: { in: ['ENVOYE', 'BROUILLON'] },
        creeLe: { lte: cutoff },
        signeLe: null,
      },
      include: {
        dossier: { select: { creeParId: true, numero: true } },
      },
      take: 50,
    });

    for (const d of devis) {
      await this.notifications.create(
        d.dossier.creeParId,
        'RAPPEL_DEVIS',
        `Devis ${d.numero} en attente (${d.dossier.numero})`,
        { factureId: d.id, dossierId: d.dossierId },
      );
    }
    return { sent: devis.length };
  }
}

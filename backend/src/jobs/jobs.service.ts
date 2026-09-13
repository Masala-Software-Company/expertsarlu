import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class JobsService {
  private readonly log = new Logger(JobsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private mail: MailService,
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

  /**
   * Rappels rendez-vous patients :
   * - J-1 (veille) à 8h
   * - J0 (jour J) à 7h
   * E-mail via Resend + notif interne aux agents assignés / protocole.
   */
  @Cron('0 8 * * *')
  async rappelRendezVousJ1() {
    return this.envoyerRappelsRendezVous('J-1');
  }

  @Cron('0 7 * * *')
  async rappelRendezVousJ0() {
    return this.envoyerRappelsRendezVous('J0');
  }

  private async envoyerRappelsRendezVous(horizon: 'J-1' | 'J0') {
    const now = new Date();
    const target = new Date(now);
    if (horizon === 'J-1') target.setDate(target.getDate() + 1);

    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    const rdvs = await this.prisma.rendezVous.findMany({
      where:
        horizon === 'J-1'
          ? {
              dateHeure: { gte: start, lte: end },
              statut: { in: ['PLANIFIE', 'CONFIRME'] },
              rappelJ1EnvoyeLe: null,
            }
          : {
              dateHeure: { gte: start, lte: end },
              statut: { in: ['PLANIFIE', 'CONFIRME'] },
              rappelJ0EnvoyeLe: null,
            },
      include: {
        dossier: {
          select: {
            id: true,
            numero: true,
            creeParId: true,
            patient: { select: { prenom: true, nom: true, email: true } },
          },
        },
        assigneA: { select: { id: true, email: true, nom: true } },
      },
      take: 200,
    });

    let sent = 0;
    for (const rdv of rdvs) {
      const patient = rdv.dossier?.patient;
      const patientEmail = patient?.email?.trim();
      const patientNom = patient
        ? `${patient.prenom} ${patient.nom}`
        : 'Patient';

      if (patientEmail && rdv.dossier) {
        const result = await this.mail.sendRappelRendezVous({
          to: patientEmail,
          patientNom,
          dossierNumero: rdv.dossier.numero,
          type: rdv.type,
          dateHeure: rdv.dateHeure,
          lieu: rdv.lieu,
          horizon,
        });
        if (result.ok) sent += 1;

        await this.prisma.communication.create({
          data: {
            dossierId: rdv.dossier.id,
            canal: 'EMAIL',
            sens: 'SORTANT',
            sujet: `Rappel rendez-vous ${horizon}`,
            corps: `Rappel ${horizon} envoyé pour ${rdv.type} le ${rdv.dateHeure.toISOString()} (${result.skipped ? 'simulation / Resend non configuré' : 'envoyé'}).`,
            auteurNom: 'Système eXpert',
          },
        });
      }

      // Notifier l’agent assigné + créateur du dossier
      const notifyIds = new Set<string>();
      if (rdv.assigneAId) notifyIds.add(rdv.assigneAId);
      if (rdv.dossier?.creeParId) notifyIds.add(rdv.dossier.creeParId);

      const label =
        horizon === 'J-1'
          ? `RDV demain — ${rdv.dossier?.numero ?? 'sans dossier'} (${rdv.type})`
          : `RDV aujourd’hui — ${rdv.dossier?.numero ?? 'sans dossier'} (${rdv.type})`;

      for (const userId of notifyIds) {
        await this.notifications.create(userId, 'RAPPEL_RDV', label, {
          rendezVousId: rdv.id,
          dossierId: rdv.dossierId,
          horizon,
          dateHeure: rdv.dateHeure.toISOString(),
        });
      }

      await this.prisma.rendezVous.update({
        where: { id: rdv.id },
        data:
          horizon === 'J-1'
            ? { rappelJ1EnvoyeLe: new Date() }
            : { rappelJ0EnvoyeLe: new Date() },
      });
    }

    this.log.log(`Rappels RDV ${horizon} : ${sent} e-mail(s), ${rdvs.length} RDV traité(s)`);
    return { horizon, treated: rdvs.length, emails: sent };
  }

  /** Rappel échéances logistique (J-1) aux agents assignés */
  @Cron('0 8 * * *')
  async rappelEcheancesLogistique() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setHours(23, 59, 59, 999);

    const taches = await this.prisma.tacheLogistique.findMany({
      where: {
        echeance: { gte: start, lte: end },
        statut: { in: ['A_FAIRE', 'EN_COURS'] },
        assigneAId: { not: null },
      },
      include: {
        dossier: { select: { id: true, numero: true } },
      },
      take: 100,
    });

    for (const t of taches) {
      if (!t.assigneAId) continue;
      await this.notifications.create(
        t.assigneAId,
        'RAPPEL_LOGISTIQUE',
        `Échéance demain — ${t.titre} (${t.dossier.numero})`,
        { tacheId: t.id, dossierId: t.dossierId },
      );
    }
    return { sent: taches.length };
  }
}

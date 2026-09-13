import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DossierStatut, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

const LOCKED_STATUSES: DossierStatut[] = [
  DossierStatut.VALIDE,
  DossierStatut.FACTURE_PAYE,
  DossierStatut.VERROUILLE,
];

@Injectable()
export class DossiersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateDossierDto, user: AuthUser) {
    const numero = await this.nextNumero();
    const dossier = await this.prisma.dossier.create({
      data: {
        numero,
        typeClient: dto.typeClient,
        destination: dto.destination,
        pathologie: dto.pathologie,
        budget: dto.budget,
        priorite: dto.priorite ?? 'NORMALE',
        notes: dto.notes,
        statut: 'EN_COURS',
        creeParId: user.id,
        patient: dto.patient
          ? {
              create: {
                nom: dto.patient.nom,
                prenom: dto.patient.prenom,
                dateNaissance: dto.patient.dateNaissance
                  ? new Date(dto.patient.dateNaissance)
                  : undefined,
                nationalite: dto.patient.nationalite,
                telephone: dto.patient.telephone,
                email: dto.patient.email,
                adresse: dto.patient.adresse,
                numeroPasseport: dto.patient.numeroPasseport,
              },
            }
          : undefined,
        accompagnateurs: dto.accompagnateurs?.length
          ? {
              create: dto.accompagnateurs.map((a) => ({
                nom: a.nom,
                prenom: a.prenom,
                lien: a.lien,
                telephone: a.telephone,
              })),
            }
          : undefined,
      },
      include: this.defaultInclude(),
    });

    await this.audit.log({
      userId: user.id,
      action: 'CREATE',
      tableCible: 'dossiers',
      recordId: dossier.id,
      nouvelleValeur: { numero: dossier.numero },
    });

    return dossier;
  }

  async findAll(user: AuthUser, q?: string) {
    const where: Prisma.DossierWhereInput = {
      statut: { not: 'ARCHIVE_SUPPRIME' },
      ...(q
        ? {
            OR: [
              { numero: { contains: q, mode: 'insensitive' } },
              { destination: { contains: q, mode: 'insensitive' } },
              { pathologie: { contains: q, mode: 'insensitive' } },
              { patient: { nom: { contains: q, mode: 'insensitive' } } },
              { patient: { prenom: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const dossiers = await this.prisma.dossier.findMany({
      where,
      include: this.defaultInclude(),
      orderBy: { majLe: 'desc' },
    });

    return dossiers.map((d) => this.serializeForRole(d, user.role));
  }

  async findOne(id: string, user: AuthUser) {
    const dossier = await this.prisma.dossier.findFirst({
      where: { id, statut: { not: 'ARCHIVE_SUPPRIME' } },
      include: this.defaultInclude(),
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable');
    return this.serializeForRole(dossier, user.role);
  }

  async update(id: string, dto: UpdateDossierDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const dossier = await tx.dossier.findUnique({ where: { id } });
      if (!dossier || dossier.statut === 'ARCHIVE_SUPPRIME') {
        throw new NotFoundException('Dossier introuvable');
      }

      await this.assertWritable(dossier, user, tx);

      const updated = await tx.dossier.update({
        where: { id },
        data: {
          typeClient: dto.typeClient,
          destination: dto.destination,
          pathologie: dto.pathologie,
          budget: dto.budget,
          priorite: dto.priorite,
          notes: dto.notes,
          patient: dto.patient
            ? {
                upsert: {
                  create: {
                    nom: dto.patient.nom,
                    prenom: dto.patient.prenom,
                    telephone: dto.patient.telephone,
                    email: dto.patient.email,
                    nationalite: dto.patient.nationalite,
                    adresse: dto.patient.adresse,
                  },
                  update: {
                    nom: dto.patient.nom,
                    prenom: dto.patient.prenom,
                    telephone: dto.patient.telephone,
                    email: dto.patient.email,
                    nationalite: dto.patient.nationalite,
                    adresse: dto.patient.adresse,
                  },
                },
              }
            : undefined,
        },
        include: this.defaultInclude(),
      });

      await this.audit.log(
        {
          userId: user.id,
          action: 'UPDATE',
          tableCible: 'dossiers',
          recordId: id,
          ancienneValeur: dossier as never,
          nouvelleValeur: { ...dto },
        },
        tx,
      );

      return this.serializeForRole(updated, user.role);
    });
  }

  async validate(id: string, user: AuthUser) {
    if (!['SUPER_ADMIN', 'ASSISTANT_MANAGER'].includes(user.role)) {
      throw new ForbiddenException('Seuls Assistant Manager / Super Admin peuvent valider');
    }

    return this.prisma.$transaction(async (tx) => {
      const dossier = await tx.dossier.findUnique({ where: { id } });
      if (!dossier || dossier.statut === 'ARCHIVE_SUPPRIME') {
        throw new NotFoundException('Dossier introuvable');
      }
      if (LOCKED_STATUSES.includes(dossier.statut)) {
        throw new ConflictException('Dossier déjà validé/verrouillé');
      }

      const updated = await tx.dossier.update({
        where: { id },
        data: {
          statut: 'VALIDE',
          verrouille: true,
          valideParId: user.id,
        },
        include: this.defaultInclude(),
      });

      await this.audit.log(
        {
          userId: user.id,
          action: 'VALIDATE',
          tableCible: 'dossiers',
          recordId: id,
          nouvelleValeur: { statut: 'VALIDE', verrouille: true },
        },
        tx,
      );

      return updated;
    });
  }

  async softDelete(id: string, user: AuthUser) {
    const dossier = await this.prisma.dossier.findUnique({ where: { id } });
    if (!dossier || dossier.statut === 'ARCHIVE_SUPPRIME') {
      throw new NotFoundException('Dossier introuvable');
    }

    const updated = await this.prisma.dossier.update({
      where: { id },
      data: {
        statutAvantSuppression: dossier.statut,
        statut: 'ARCHIVE_SUPPRIME',
        supprimeLe: new Date(),
        supprimeParId: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'SOFT_DELETE',
      tableCible: 'dossiers',
      recordId: id,
      ancienneValeur: { statut: dossier.statut },
      nouvelleValeur: { statut: 'ARCHIVE_SUPPRIME' },
    });

    return {
      message:
        'Ce dossier a été déplacé vers la corbeille et sera récupérable pendant 90 jours.',
      dossier: updated,
    };
  }

  async corbeille(user: AuthUser) {
    if (!['SUPER_ADMIN', 'ASSISTANT_MANAGER'].includes(user.role)) {
      throw new ForbiddenException();
    }
    return this.prisma.dossier.findMany({
      where: { statut: 'ARCHIVE_SUPPRIME' },
      include: {
        patient: true,
        creePar: { select: { id: true, nom: true } },
        supprimePar: { select: { id: true, nom: true } },
      },
      orderBy: { supprimeLe: 'desc' },
    });
  }

  async restore(id: string, user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN') throw new ForbiddenException();

    const dossier = await this.prisma.dossier.findUnique({ where: { id } });
    if (!dossier || dossier.statut !== 'ARCHIVE_SUPPRIME') {
      throw new NotFoundException('Dossier absent de la corbeille');
    }

    const restored = await this.prisma.dossier.update({
      where: { id },
      data: {
        statut: dossier.statutAvantSuppression ?? 'EN_COURS',
        statutAvantSuppression: null,
        supprimeLe: null,
        supprimeParId: null,
      },
      include: this.defaultInclude(),
    });

    await this.audit.log({
      userId: user.id,
      action: 'RESTORE',
      tableCible: 'dossiers',
      recordId: id,
      nouvelleValeur: { statut: restored.statut },
    });

    return restored;
  }

  async hardDelete(id: string, confirmationNumero: string, user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN') throw new ForbiddenException();

    const dossier = await this.prisma.dossier.findUnique({ where: { id } });
    if (!dossier || dossier.statut !== 'ARCHIVE_SUPPRIME') {
      throw new NotFoundException('Dossier absent de la corbeille');
    }
    if (confirmationNumero !== dossier.numero) {
      throw new BadRequestException(
        'Confirmation incorrecte — tapez le numéro exact du dossier',
      );
    }

    await this.audit.log({
      userId: user.id,
      action: 'HARD_DELETE',
      tableCible: 'dossiers',
      recordId: id,
      ancienneValeur: { numero: dossier.numero },
    });

    await this.prisma.dossier.delete({ where: { id } });
    return { ok: true };
  }

  async demandeDeverrouillage(id: string, motif: string, user: AuthUser) {
    const dossier = await this.prisma.dossier.findUnique({ where: { id } });
    if (!dossier) throw new NotFoundException();
    if (!dossier.verrouille && !LOCKED_STATUSES.includes(dossier.statut)) {
      throw new BadRequestException('Ce dossier n’est pas verrouillé');
    }

    // Super Admin : déverrouille immédiatement, pas de demande
    if (user.role === 'SUPER_ADMIN') {
      return this.deverrouillerDirect(id, user);
    }

    const demande = await this.prisma.demandeDeverrouillage.create({
      data: {
        dossierId: id,
        demandeParId: user.id,
        motif,
      },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', actif: true },
    });
    await Promise.all(
      admins.map((a) =>
        this.notifications.create(
          a.id,
          'UNLOCK_REQUEST',
          `Déverrouillage demandé — ${dossier.numero}`,
          {
            dossierId: id,
            numero: dossier.numero,
            motif,
            demandeId: demande.id,
            demandePar: user.nom,
          },
        ),
      ),
    );

    await this.audit.log({
      userId: user.id,
      action: 'UNLOCK_REQUEST',
      tableCible: 'demandes_deverrouillage',
      recordId: demande.id,
      nouvelleValeur: { dossierId: id, motif },
    });

    return demande;
  }

  /** Déverrouillage immédiat (Super Admin uniquement). */
  async deverrouillerDirect(id: string, user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    const dossier = await this.prisma.dossier.findUnique({ where: { id } });
    if (!dossier || dossier.statut === 'ARCHIVE_SUPPRIME') {
      throw new NotFoundException();
    }

    const hours = Number(this.config.get('UNLOCK_TTL_HOURS', 24));
    const expireLe = new Date(Date.now() + hours * 3_600_000);

    const updated = await this.prisma.dossier.update({
      where: { id },
      data: {
        verrouille: false,
        statut: dossier.statut === 'VALIDE' || dossier.statut === 'VERROUILLE' ? 'EN_COURS' : dossier.statut,
      },
      include: this.defaultInclude(),
    });

    // Approuve d’éventuelles demandes en attente
    await this.prisma.demandeDeverrouillage.updateMany({
      where: { dossierId: id, statut: 'EN_ATTENTE' },
      data: {
        statut: 'APPROUVE',
        traiteParId: user.id,
        traiteLe: new Date(),
        expireLe,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'UNLOCK_APPROVE',
      tableCible: 'dossiers',
      recordId: id,
      nouvelleValeur: { direct: true, expireLe },
    });

    return this.serializeForRole(updated as never, user.role);
  }

  async refuserDeverrouillage(demandeId: string, user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    const demande = await this.prisma.demandeDeverrouillage.findUnique({
      where: { id: demandeId },
      include: { dossier: { select: { numero: true } } },
    });
    if (!demande || demande.statut !== 'EN_ATTENTE') {
      throw new NotFoundException('Demande introuvable');
    }

    const updated = await this.prisma.demandeDeverrouillage.update({
      where: { id: demandeId },
      data: {
        statut: 'REFUSE',
        traiteParId: user.id,
        traiteLe: new Date(),
      },
    });

    await this.notifications.create(
      demande.demandeParId,
      'UNLOCK_REFUSED',
      `Déverrouillage refusé — ${demande.dossier.numero}`,
      { dossierId: demande.dossierId, demandeId },
    );

    await this.audit.log({
      userId: user.id,
      action: 'UNLOCK_REFUSE',
      tableCible: 'demandes_deverrouillage',
      recordId: demandeId,
    });

    return updated;
  }

  async listDemandesUnlock(user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ASSISTANT_MANAGER') {
      throw new ForbiddenException();
    }
    return this.prisma.demandeDeverrouillage.findMany({
      where: { statut: 'EN_ATTENTE' },
      include: {
        dossier: { select: { id: true, numero: true } },
        demandePar: { select: { id: true, nom: true, email: true } },
      },
      orderBy: { creeLe: 'desc' },
    });
  }

  async approuverDeverrouillage(demandeId: string, user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN') throw new ForbiddenException();

    const hours = Number(this.config.get('UNLOCK_TTL_HOURS', 24));
    const expireLe = new Date(Date.now() + hours * 3_600_000);

    return this.prisma.$transaction(async (tx) => {
      const demande = await tx.demandeDeverrouillage.findUnique({
        where: { id: demandeId },
      });
      if (!demande || demande.statut !== 'EN_ATTENTE') {
        throw new NotFoundException('Demande introuvable');
      }

      const updated = await tx.demandeDeverrouillage.update({
        where: { id: demandeId },
        data: {
          statut: 'APPROUVE',
          traiteParId: user.id,
          traiteLe: new Date(),
          expireLe,
        },
      });

      await tx.dossier.update({
        where: { id: demande.dossierId },
        data: { verrouille: false, statut: 'EN_COURS' },
      });

      await this.audit.log(
        {
          userId: user.id,
          action: 'UNLOCK_APPROVE',
          tableCible: 'dossiers',
          recordId: demande.dossierId,
          nouvelleValeur: { expireLe },
        },
        tx,
      );

      await this.notifications.create(
        demande.demandeParId,
        'UNLOCK_APPROVED',
        'Déverrouillage approuvé',
        { dossierId: demande.dossierId, expireLe },
      );

      return updated;
    });
  }

  private async nextNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.$transaction(async (tx) => {
      const current = await tx.dossierSequence.upsert({
        where: { annee: year },
        create: { annee: year, dernier: 1 },
        update: { dernier: { increment: 1 } },
      });
      return current.dernier;
    });
    return `MED-${year}-${String(seq).padStart(4, '0')}`;
  }

  private async assertWritable(
    dossier: { id: string; statut: DossierStatut; verrouille: boolean },
    user: AuthUser,
    tx: Prisma.TransactionClient,
  ) {
    if (user.role === 'SUPER_ADMIN') return;

    if (dossier.verrouille || LOCKED_STATUSES.includes(dossier.statut)) {
      const approved = await tx.demandeDeverrouillage.findFirst({
        where: {
          dossierId: dossier.id,
          statut: 'APPROUVE',
          expireLe: { gt: new Date() },
        },
      });
      if (!approved) {
        throw new ForbiddenException(
          'Dossier verrouillé — demandez une autorisation au Super Admin',
        );
      }
    }
  }

  private defaultInclude() {
    return {
      patient: true,
      accompagnateurs: true,
      lignesCotation: true,
      calculAssurance: true,
      creePar: { select: { id: true, nom: true, role: true } },
      validePar: { select: { id: true, nom: true } },
      tachesLogistique: true,
      rendezVous: true,
      factures: { include: { paiements: true } },
    } as const;
  }

  /** Les agents Protocole ne reçoivent jamais de champs financiers */
  private serializeForRole<T extends Record<string, unknown>>(dossier: T, role: string) {
    if (role !== 'PROTOCOLE') return dossier;
    const {
      lignesCotation: _lc,
      calculAssurance: _ca,
      factures: _f,
      budget: _b,
      ...safe
    } = dossier as T & {
      lignesCotation?: unknown;
      calculAssurance?: unknown;
      factures?: unknown;
      budget?: unknown;
    };
    return safe;
  }

  async changerStatut(id: string, statut: DossierStatut, user: AuthUser) {
    const allowed: DossierStatut[] = [
      'BROUILLON',
      'EN_COURS',
      'VALIDE',
      'FACTURE_PAYE',
      'VERROUILLE',
    ];
    if (!allowed.includes(statut)) {
      throw new BadRequestException('Statut non autorisé');
    }
    return this.prisma.$transaction(async (tx) => {
      const dossier = await tx.dossier.findUnique({ where: { id } });
      if (!dossier || dossier.statut === 'ARCHIVE_SUPPRIME') {
        throw new NotFoundException();
      }
      await this.assertWritable(dossier, user, tx);
      const updated = await tx.dossier.update({
        where: { id },
        data: {
          statut,
          verrouille: ['VALIDE', 'FACTURE_PAYE', 'VERROUILLE'].includes(statut),
        },
        include: this.defaultInclude(),
      });
      await this.audit.log({
        userId: user.id,
        action: 'STATUT_CHANGE',
        tableCible: 'dossiers',
        recordId: id,
        ancienneValeur: { statut: dossier.statut },
        nouvelleValeur: { statut },
      });
      return this.serializeForRole(updated as never, user.role);
    });
  }

  async ensureSuiviToken(id: string, user: AuthUser) {
    const dossier = await this.prisma.dossier.findUnique({ where: { id } });
    if (!dossier || dossier.statut === 'ARCHIVE_SUPPRIME') {
      throw new NotFoundException();
    }
    if (dossier.suiviToken) {
      return { token: dossier.suiviToken, url: `/suivi/${dossier.suiviToken}` };
    }
    const token = randomUUID();
    await this.prisma.dossier.update({
      where: { id },
      data: { suiviToken: token },
    });
    await this.audit.log({
      userId: user.id,
      action: 'SUIVI_TOKEN',
      tableCible: 'dossiers',
      recordId: id,
      nouvelleValeur: { token },
    });
    return { token, url: `/suivi/${token}` };
  }

  async getBySuiviToken(token: string) {
    const dossier = await this.prisma.dossier.findFirst({
      where: { suiviToken: token, statut: { not: 'ARCHIVE_SUPPRIME' } },
      select: {
        numero: true,
        statut: true,
        destination: true,
        pathologie: true,
        postRetourStatut: true,
        postRetourNotes: true,
        postRetourLe: true,
        patient: {
          select: { prenom: true, nom: true },
        },
        tachesLogistique: {
          select: { titre: true, type: true, statut: true },
          orderBy: { creeLe: 'asc' },
        },
        rendezVous: {
          select: { type: true, dateHeure: true, lieu: true, statut: true },
          orderBy: { dateHeure: 'asc' },
          take: 10,
        },
      },
    });
    if (!dossier) throw new NotFoundException('Lien de suivi invalide');
    return dossier;
  }

  async updatePostRetour(
    id: string,
    data: { postRetourStatut: string; postRetourNotes?: string },
    user: AuthUser,
  ) {
    const allowed = ['EN_ATTENTE', 'RENTRE', 'SUIVI', 'CLOS'];
    if (!allowed.includes(data.postRetourStatut)) {
      throw new BadRequestException('Statut post-retour invalide');
    }
    return this.prisma.$transaction(async (tx) => {
      const dossier = await tx.dossier.findUnique({ where: { id } });
      if (!dossier || dossier.statut === 'ARCHIVE_SUPPRIME') {
        throw new NotFoundException();
      }
      await this.assertWritable(dossier, user, tx);
      const updated = await tx.dossier.update({
        where: { id },
        data: {
          postRetourStatut: data.postRetourStatut,
          postRetourNotes: data.postRetourNotes,
          postRetourLe: new Date(),
        },
        include: this.defaultInclude(),
      });
      return this.serializeForRole(updated as never, user.role);
    });
  }
}

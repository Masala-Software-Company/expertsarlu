import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PreInscriptionStatut, Prisma, TypeClient, TypeDocumentVoyage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { DossiersService } from '../dossiers/dossiers.service';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);

export type PreInscriptionPayload = {
  categorie: TypeClient;
  partenaireId?: string;
  institution?: {
    nom: string;
    adresse?: string;
    telephone?: string;
    contactNom?: string;
    contactPrenom?: string;
    contactAdresse?: string;
    contactTelephone?: string;
    contactFax?: string;
    contactEmail?: string;
  };
  identite: {
    nom: string;
    nomNaissance?: string;
    prenom: string;
    dateNaissance: string;
    lieuNaissance?: string;
    paysNaissance?: string;
    nationaliteActuelle: string;
    nationaliteNaissance?: string;
    autresNationalites?: string;
    sexe: 'MASCULIN' | 'FEMININ';
    etatCivil: string;
    numeroNational?: string;
    numeroPieceIdentite?: string;
    statutPatient?: 'ADULTE' | 'ENFANT_SOUS_TUTELLE' | 'ADULTE_SOUS_TUTELLE';
  };
  tuteur?: {
    nom: string;
    prenom: string;
    adresse?: string;
    telephone?: string;
    email?: string;
    nationalite?: string;
  };
  coordonnees: {
    adresse: string;
    email: string;
    telephone: string;
  };
  residenceEtrangere?: {
    oui: boolean;
    numeroAutorisation?: string;
    expirationAutorisation?: string;
  };
  documentVoyage: {
    type: TypeDocumentVoyage;
    numero: string;
    dateDelivrance: string;
    dateExpiration: string;
    paysDelivrance: string;
  };
  professionnel?: {
    profession?: string;
    employeurNom?: string;
    employeurAdresse?: string;
    employeurTelephone?: string;
  };
  confirmationExactitude: boolean;
  /** Honeypot anti-bot — doit rester vide */
  website?: string;
};

@Injectable()
export class PreInscriptionsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private dossiers: DossiersService,
  ) {}

  normalizeInstitutionName(nom: string) {
    return nom
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  listInstitutionsPubliques() {
    return this.prisma.partenaire.findMany({
      where: { actif: true },
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, pays: true },
    });
  }

  private async nextReference() {
    const year = new Date().getFullYear();
    const prefix = `PRE-${year}-`;
    const last = await this.prisma.preInscription.findFirst({
      where: { reference: { startsWith: prefix } },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });
    const n = last ? Number(last.reference.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(n).padStart(4, '0')}`;
  }

  private validatePayload(raw: PreInscriptionPayload) {
    if (raw.website) {
      throw new BadRequestException('Soumission rejetée');
    }
    if (!raw.confirmationExactitude) {
      throw new BadRequestException('Vous devez confirmer l’exactitude des informations');
    }
    if (!raw.identite?.nom?.trim() || !raw.identite?.prenom?.trim()) {
      throw new BadRequestException('Nom et prénom obligatoires');
    }
    if (!raw.identite?.dateNaissance) {
      throw new BadRequestException('Date de naissance obligatoire');
    }
    if (!raw.coordonnees?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.coordonnees.email)) {
      throw new BadRequestException('Adresse e-mail invalide');
    }
    if (!raw.coordonnees?.telephone?.trim()) {
      throw new BadRequestException('Téléphone obligatoire');
    }
    if (!raw.coordonnees?.adresse?.trim()) {
      throw new BadRequestException('Adresse obligatoire');
    }
    const del = new Date(raw.documentVoyage.dateDelivrance);
    const exp = new Date(raw.documentVoyage.dateExpiration);
    if (!(exp > del)) {
      throw new BadRequestException(
        'La date d’expiration du document de voyage doit être postérieure à la date de délivrance',
      );
    }
    if (raw.categorie === 'INSTITUTION') {
      if (!raw.partenaireId?.trim()) {
        throw new BadRequestException(
          'Sélectionnez une institution partenaire enregistrée chez eXpert SARLU',
        );
      }
    }
    const needsTuteur =
      raw.identite.statutPatient === 'ENFANT_SOUS_TUTELLE' ||
      raw.identite.statutPatient === 'ADULTE_SOUS_TUTELLE';
    if (needsTuteur && !raw.tuteur?.nom?.trim()) {
      throw new BadRequestException(
        'Les informations du tuteur / autorité parentale sont obligatoires pour ce statut',
      );
    }
  }

  async soumettrePublic(
    payload: PreInscriptionPayload,
    file: Express.Multer.File | undefined,
    meta: { ip?: string; userAgent?: string },
  ) {
    this.validatePayload(payload);

    if (!file?.buffer?.length) {
      throw new BadRequestException('La photo de profil est obligatoire');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Formats photo acceptés : JPG, JPEG, PNG');
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new BadRequestException('La photo ne doit pas dépasser 5 Mo');
    }

    let partenaireId = payload.partenaireId ?? null;
    if (payload.categorie === 'INSTITUTION' && !partenaireId && payload.institution?.nom) {
      // Ne crée pas l’institution automatiquement — stocke la saisie pour validation staff
      partenaireId = null;
    }
    if (partenaireId) {
      const p = await this.prisma.partenaire.findFirst({
        where: { id: partenaireId, actif: true },
      });
      if (!p) throw new BadRequestException('Institution introuvable ou inactive');
    }

    const ext = file.mimetype.includes('png') ? 'png' : 'jpg';
    const photoChemin = await this.storage.put(
      'pre-inscriptions',
      `photo.${ext}`,
      file.buffer,
      file.mimetype,
    );

    const reference = await this.nextReference();
    const created = await this.prisma.preInscription.create({
      data: {
        reference,
        statut: 'A_VERIFIER',
        categorie: payload.categorie,
        partenaireId,
        institutionSaisie:
          payload.categorie === 'INSTITUTION' && !partenaireId
            ? (payload.institution as never)
            : payload.institution
              ? (payload.institution as never)
              : undefined,
        nom: payload.identite.nom.trim(),
        prenom: payload.identite.prenom.trim(),
        dateNaissance: new Date(payload.identite.dateNaissance),
        email: payload.coordonnees.email.trim().toLowerCase(),
        telephone: payload.coordonnees.telephone.trim(),
        numeroPasseport: payload.documentVoyage.numero.trim(),
        numeroNational:
          payload.identite.numeroPieceIdentite?.trim() ||
          payload.identite.numeroNational?.trim() ||
          null,
        photoChemin,
        donnees: payload as never,
        ipSoumission: meta.ip,
        userAgent: meta.userAgent,
        historique: [
          {
            at: new Date().toISOString(),
            action: 'SOUMIS',
            detail: 'Soumission portail public',
          },
        ] as never,
      },
      include: { partenaire: { select: { nom: true } } },
    });

    await this.audit.log({
      action: 'PRE_INSCRIPTION_SOUMISE',
      tableCible: 'pre_inscriptions',
      recordId: created.id,
      nouvelleValeur: { reference, nom: created.nom, prenom: created.prenom },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.notifyStaff(created);

    return {
      reference: created.reference,
      statut: created.statut,
      message:
        'Votre demande a bien été transmise. Notre équipe la vérifiera avant création du dossier.',
    };
  }

  private async notifyStaff(row: {
    id: string;
    reference: string;
    nom: string;
    prenom: string;
    categorie: TypeClient;
    partenaire?: { nom: string } | null;
    creeLe: Date;
  }) {
    const staff = await this.prisma.user.findMany({
      where: {
        actif: true,
        role: { in: ['SUPER_ADMIN', 'ASSISTANT_MANAGER', 'SUPPORT_CLIENT'] },
      },
      select: { id: true },
    });
    const titre = 'Nouveau dossier patient reçu';
    const payload = {
      reference: row.reference,
      nom: `${row.prenom} ${row.nom}`,
      categorie: row.categorie,
      institution: row.partenaire?.nom ?? null,
      date: row.creeLe.toISOString(),
      preInscriptionId: row.id,
      statut: 'A_VERIFIER',
    };
    await Promise.all(
      staff.map((u) =>
        this.notifications.create(u.id, 'PRE_INSCRIPTION', titre, payload),
      ),
    );
  }

  listInterne(filters: {
    q?: string;
    statut?: PreInscriptionStatut;
    categorie?: TypeClient;
    partenaireId?: string;
  }) {
    const where: Prisma.PreInscriptionWhereInput = {};
    if (filters.statut) where.statut = filters.statut;
    if (filters.categorie) where.categorie = filters.categorie;
    if (filters.partenaireId) where.partenaireId = filters.partenaireId;
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { nom: { contains: q, mode: 'insensitive' } },
        { prenom: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { numeroPasseport: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.preInscription.findMany({
      where,
      orderBy: { creeLe: 'desc' },
      include: {
        partenaire: { select: { id: true, nom: true } },
        traitePar: { select: { id: true, nom: true } },
        dossier: { select: { id: true, numero: true } },
      },
    });
  }

  async getOne(id: string) {
    const row = await this.prisma.preInscription.findUnique({
      where: { id },
      include: {
        partenaire: true,
        traitePar: { select: { id: true, nom: true } },
        dossier: { select: { id: true, numero: true } },
      },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async photoStream(id: string) {
    const row = await this.getOne(id);
    if (!row.photoChemin) throw new NotFoundException('Photo introuvable');
    const opened = await this.storage.open(row.photoChemin);
    if (!opened) throw new NotFoundException('Photo introuvable');
    return opened;
  }

  private appendHistory(
    current: unknown,
    entry: { action: string; detail?: string; userId?: string; userNom?: string },
  ) {
    const list = Array.isArray(current) ? [...current] : [];
    list.push({ at: new Date().toISOString(), ...entry });
    return list;
  }

  async updateStatut(
    id: string,
    statut: PreInscriptionStatut,
    user: AuthUser,
    motif?: string,
  ) {
    const row = await this.getOne(id);
    if (row.statut === 'DOSSIER_CREE') {
      throw new ConflictException('Ce dossier a déjà été créé');
    }
    return this.prisma.preInscription.update({
      where: { id },
      data: {
        statut,
        motifRejet: motif ?? row.motifRejet,
        traiteParId: user.id,
        traiteLe: new Date(),
        historique: this.appendHistory(row.historique, {
          action: `STATUT_${statut}`,
          detail: motif,
          userId: user.id,
          userNom: user.nom,
        }) as never,
      },
    });
  }

  async detectDoublons(id: string) {
    const row = await this.getOne(id);
    const or: Prisma.PatientWhereInput[] = [];
    if (row.email) or.push({ email: { equals: row.email, mode: 'insensitive' } });
    if (row.telephone) or.push({ telephone: row.telephone });
    if (row.numeroPasseport) or.push({ numeroPasseport: row.numeroPasseport });
    if (row.numeroNational) or.push({ numeroNational: row.numeroNational });
    or.push({
      AND: [
        { nom: { equals: row.nom, mode: 'insensitive' } },
        { prenom: { equals: row.prenom, mode: 'insensitive' } },
        ...(row.dateNaissance ? [{ dateNaissance: row.dateNaissance }] : []),
      ],
    });

    const patients = await this.prisma.patient.findMany({
      where: { OR: or },
      take: 10,
      include: {
        dossier: { select: { id: true, numero: true, statut: true } },
        partenaire: { select: { nom: true } },
      },
    });

    return {
      risque: patients.length > 0,
      message: patients.length
        ? 'Un patient correspondant existe peut-être déjà. Vérifiez avant de créer un nouveau dossier.'
        : null,
      correspondances: patients,
    };
  }

  async creerDossier(
    id: string,
    user: AuthUser,
    opts?: { forcerMalgreDoublon?: boolean; partenaireId?: string },
  ) {
    const row = await this.getOne(id);
    if (row.dossierId) {
      throw new ConflictException('Un dossier existe déjà pour cette demande');
    }
    if (['REJETE'].includes(row.statut)) {
      throw new BadRequestException('Demande rejetée — impossible de créer le dossier');
    }

    const doublons = await this.detectDoublons(id);
    if (doublons.risque && !opts?.forcerMalgreDoublon) {
      throw new ConflictException({
        code: 'POSSIBLE_DUPLICATE',
        message: doublons.message,
        correspondances: doublons.correspondances,
      });
    }

    let partenaireId = opts?.partenaireId ?? row.partenaireId ?? undefined;
    const saisies = row.institutionSaisie as {
      nom?: string;
      adresse?: string;
      telephone?: string;
    } | null;

    if (row.categorie === 'INSTITUTION' && !partenaireId && saisies?.nom) {
      const nomNormalise = this.normalizeInstitutionName(saisies.nom);
      const existing = await this.prisma.partenaire.findUnique({
        where: { nomNormalise },
      });
      if (existing) {
        partenaireId = existing.id;
        if (!existing.actif) {
          await this.prisma.partenaire.update({
            where: { id: existing.id },
            data: { actif: true },
          });
        }
      } else {
        const created = await this.prisma.partenaire.create({
          data: {
            nom: saisies.nom.trim(),
            nomNormalise,
            adresse: saisies.adresse,
            telephone: saisies.telephone,
            type: 'INSTITUTION',
            actif: true,
          },
        });
        partenaireId = created.id;
      }
    }

    const donnees = row.donnees as PreInscriptionPayload;
    const dossier = await this.dossiers.create(
      {
        typeClient: row.categorie,
        notes: `Pré-inscription ${row.reference}`,
        priorite: 'NORMALE',
        patient: {
          nom: row.nom,
          prenom: row.prenom,
          dateNaissance: row.dateNaissance?.toISOString().slice(0, 10),
          nationalite: donnees.identite?.nationaliteActuelle,
          telephone: row.telephone ?? undefined,
          email: row.email ?? undefined,
          adresse: donnees.coordonnees?.adresse,
          numeroPasseport: row.numeroPasseport ?? undefined,
        },
      },
      user,
    );

    await this.prisma.dossier.update({
      where: { id: dossier.id },
      data: { partenaireId: partenaireId ?? null },
    });

    await this.prisma.patient.update({
      where: { dossierId: dossier.id },
      data: {
        partenaireId: partenaireId ?? null,
        photoProfil: row.photoChemin,
        numeroNational: row.numeroNational,
        donneesComplementaires: donnees as never,
      },
    });

    await this.prisma.preInscription.update({
      where: { id },
      data: {
        statut: 'DOSSIER_CREE',
        dossierId: dossier.id,
        partenaireId: partenaireId ?? row.partenaireId,
        traiteParId: user.id,
        traiteLe: new Date(),
        historique: this.appendHistory(row.historique, {
          action: 'DOSSIER_CREE',
          detail: dossier.numero,
          userId: user.id,
          userNom: user.nom,
        }) as never,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'PRE_INSCRIPTION_DOSSIER_CREE',
      tableCible: 'pre_inscriptions',
      recordId: id,
      nouvelleValeur: { dossierId: dossier.id, numero: dossier.numero },
    });

    return { dossier, preInscriptionId: id };
  }
}

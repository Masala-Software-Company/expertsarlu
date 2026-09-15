import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export function normalizeInstitutionName(nom: string) {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

@Injectable()
export class PartenairesService {
  constructor(private prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.partenaire.findMany({
      where: includeInactive ? undefined : { actif: true },
      orderBy: { nom: 'asc' },
      include: {
        _count: { select: { patients: true, preInscriptions: true } },
      },
    });
  }

  async create(data: {
    nom: string;
    pays?: string;
    type?: string;
    contact?: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    fax?: string;
    notes?: string;
    logoChemin?: string;
  }) {
    const nomNormalise = normalizeInstitutionName(data.nom);
    const exists = await this.prisma.partenaire.findUnique({ where: { nomNormalise } });
    if (exists) {
      throw new ConflictException(
        `Une institution similaire existe déjà : « ${exists.nom} ». Réutilisez-la pour éviter les doublons.`,
      );
    }
    const now = new Date();
    return this.prisma.partenaire.create({
      data: {
        nom: data.nom.trim(),
        nomNormalise,
        pays: data.pays?.trim() || null,
        type: data.type?.trim() || null,
        contact: data.contact?.trim() || null,
        email: data.email?.trim() || null,
        telephone: data.telephone?.trim() || null,
        adresse: data.adresse?.trim() || null,
        fax: data.fax?.trim() || null,
        notes: data.notes?.trim() || null,
        logoChemin: data.logoChemin || null,
        actif: true,
        creeLe: now,
        majLe: now,
      },
    });
  }

  async update(
    id: string,
    data: {
      nom?: string;
      pays?: string;
      type?: string;
      contact?: string;
      email?: string;
      telephone?: string;
      adresse?: string;
      fax?: string;
      notes?: string;
      actif?: boolean;
    },
  ) {
    const existing = await this.prisma.partenaire.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();

    let nomNormalise = existing.nomNormalise;
    if (data.nom && data.nom.trim() !== existing.nom) {
      nomNormalise = normalizeInstitutionName(data.nom);
      const clash = await this.prisma.partenaire.findFirst({
        where: { nomNormalise, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException(
          `Une institution similaire existe déjà : « ${clash.nom} ».`,
        );
      }
    }

    return this.prisma.partenaire.update({
      where: { id },
      data: {
        ...data,
        nom: data.nom?.trim(),
        nomNormalise: nomNormalise ?? undefined,
      },
    });
  }

  /** Désactivation douce — pas de suppression hard si des patients sont liés. */
  async remove(id: string) {
    const existing = await this.prisma.partenaire.findUnique({
      where: { id },
      include: { _count: { select: { patients: true } } },
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.partenaire.update({
      where: { id },
      data: { actif: false },
    });
    return { ok: true, desactive: true };
  }

  async patients(id: string) {
    const existing = await this.prisma.partenaire.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    return this.prisma.patient.findMany({
      where: { partenaireId: id },
      include: {
        dossier: { select: { id: true, numero: true, statut: true, typeClient: true } },
      },
      orderBy: { creeLe: 'desc' },
    });
  }
}

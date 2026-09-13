import { Injectable } from '@nestjs/common';
import { Priorite, TypeClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';

type InscriptionInput = {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  nationalite?: string;
  numeroPasseport?: string;
  dateNaissance?: string;
  adresse?: string;
  pathologie?: string;
  destination?: string;
  typeClient?: TypeClient;
  priorite?: Priorite;
  notes?: string;
};

@Injectable()
export class ClientPortalService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private storage: StorageService,
  ) {}

  private async nextNumero() {
    const annee = new Date().getFullYear();
    const seq = await this.prisma.dossierSequence.upsert({
      where: { annee },
      create: { annee, dernier: 1 },
      update: { dernier: { increment: 1 } },
    });
    return `MED-${annee}-${String(seq.dernier).padStart(4, '0')}`;
  }

  private async saveFile(
    subdir: string,
    file: Express.Multer.File | undefined,
  ): Promise<string | undefined> {
    if (!file?.buffer?.length) return undefined;
    return this.storage.put(
      subdir,
      file.originalname || 'file',
      file.buffer,
      file.mimetype || 'application/octet-stream',
    );
  }

  async inscrire(
    dto: InscriptionInput,
    files: { photo?: Express.Multer.File; passeport?: Express.Multer.File },
  ) {
    const systemUser =
      (await this.prisma.user.findFirst({
        where: { role: 'SUPER_ADMIN', actif: true },
        orderBy: { creeLe: 'asc' },
      })) ??
      (await this.prisma.user.findFirst({ where: { actif: true } }));

    if (!systemUser) {
      throw new Error('Aucun utilisateur système pour rattacher le dossier client');
    }

    const photoProfil = await this.saveFile('photos', files.photo);
    const passeportPath = await this.saveFile('passeports', files.passeport);
    const numero = await this.nextNumero();

    const dossier = await this.prisma.dossier.create({
      data: {
        numero,
        typeClient: dto.typeClient ?? 'PARTICULIER',
        statut: 'BROUILLON',
        destination: dto.destination,
        pathologie: dto.pathologie,
        priorite: dto.priorite ?? 'NORMALE',
        notes: dto.notes
          ? `[Portail client] ${dto.notes}`
          : '[Portail client] Demande reçue — à qualifier par Support Client',
        creeParId: systemUser.id,
        patient: {
          create: {
            nom: dto.nom.trim(),
            prenom: dto.prenom.trim(),
            email: dto.email,
            telephone: dto.telephone,
            nationalite: dto.nationalite,
            numeroPasseport: dto.numeroPasseport,
            dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : undefined,
            adresse: dto.adresse,
            photoProfil,
            documentIdentite: passeportPath,
          },
        },
      },
      include: { patient: true },
    });

    if (passeportPath) {
      await this.prisma.documentGED.create({
        data: {
          dossierId: dossier.id,
          categorie: 'IDENTITE',
          nomFichier: files.passeport?.originalname ?? 'passeport',
          cheminStockage: passeportPath,
          mimeType: files.passeport?.mimetype ?? 'application/octet-stream',
          tailleOctets: files.passeport?.size ?? 0,
          uploadeParId: systemUser.id,
        },
      });
    }

    const support = await this.prisma.user.findMany({
      where: {
        actif: true,
        role: { in: ['SUPPORT_CLIENT', 'SUPER_ADMIN', 'ASSISTANT_MANAGER'] },
      },
      select: { id: true },
    });

    await Promise.all(
      support.map((u) =>
        this.notifications.create(
          u.id,
          'CLIENT_INSCRIPTION',
          `Nouvelle inscription portail — ${dossier.numero}`,
          {
            dossierId: dossier.id,
            patient: `${dossier.patient?.prenom} ${dossier.patient?.nom}`,
          },
        ),
      ),
    );

    return {
      ok: true,
      numero: dossier.numero,
      message:
        'Demande enregistrée. L’équipe eXpert vous contactera pour la suite du dossier.',
    };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategorieDocument } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../auth/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class GedService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private audit: AuditService,
  ) {}

  async upload(
    dossierId: string,
    file: Express.Multer.File,
    categorie: CategorieDocument,
    user: AuthUser,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier requis');
    }

    const dossier = await this.prisma.dossier.findUnique({ where: { id: dossierId } });
    if (!dossier) throw new NotFoundException('Dossier introuvable');

    const cheminStockage = await this.storage.put(
      `ged/${dossierId}`,
      file.originalname,
      file.buffer,
      file.mimetype || 'application/octet-stream',
    );

    const doc = await this.prisma.documentGED.create({
      data: {
        dossierId,
        categorie,
        nomFichier: file.originalname,
        cheminStockage,
        mimeType: file.mimetype,
        tailleOctets: file.size,
        uploadeParId: user.id,
      },
      include: { uploadePar: { select: { id: true, nom: true } } },
    });

    await this.audit.log({
      userId: user.id,
      action: 'UPLOAD_DOCUMENT',
      tableCible: 'documents_ged',
      recordId: doc.id,
      nouvelleValeur: {
        dossierId,
        categorie,
        nomFichier: doc.nomFichier,
      },
    });

    return doc;
  }

  list(dossierId: string) {
    return this.prisma.documentGED.findMany({
      where: { dossierId },
      include: { uploadePar: { select: { id: true, nom: true } } },
      orderBy: { creeLe: 'desc' },
    });
  }

  async getFile(docId: string) {
    const doc = await this.prisma.documentGED.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document introuvable');
    const opened = await this.storage.open(doc.cheminStockage);
    if (!opened) throw new NotFoundException('Fichier introuvable');
    return { doc, stream: opened.stream, contentType: opened.contentType };
  }

  async remove(docId: string, user: AuthUser) {
    const doc = await this.prisma.documentGED.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document introuvable');

    await this.storage.remove(doc.cheminStockage);

    await this.prisma.documentGED.delete({ where: { id: docId } });
    await this.audit.log({
      userId: user.id,
      action: 'DELETE_DOCUMENT',
      tableCible: 'documents_ged',
      recordId: docId,
      ancienneValeur: { nomFichier: doc.nomFichier, categorie: doc.categorie },
    });

    return { ok: true };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { CategorieDocument } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class GedService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  private root() {
    return this.config.get('GED_STORAGE_PATH', './uploads');
  }

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

    const dir = join(this.root(), dossierId);
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}-${file.originalname}`;
    const path = join(dir, filename);
    await writeFile(path, file.buffer);

    const doc = await this.prisma.documentGED.create({
      data: {
        dossierId,
        categorie,
        nomFichier: file.originalname,
        cheminStockage: path,
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
    if (!doc || !existsSync(doc.cheminStockage)) {
      throw new NotFoundException('Document introuvable');
    }
    return doc;
  }

  async remove(docId: string, user: AuthUser) {
    const doc = await this.prisma.documentGED.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document introuvable');

    try {
      if (existsSync(doc.cheminStockage)) await unlink(doc.cheminStockage);
    } catch {
      /* ignore missing file */
    }

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

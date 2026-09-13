import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { CategorieDocument } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class GedService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
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
    const dir = join(this.root(), dossierId);
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}-${file.originalname}`;
    const path = join(dir, filename);
    await writeFile(path, file.buffer);

    return this.prisma.documentGED.create({
      data: {
        dossierId,
        categorie,
        nomFichier: file.originalname,
        cheminStockage: path,
        mimeType: file.mimetype,
        tailleOctets: file.size,
        uploadeParId: user.id,
      },
    });
  }

  list(dossierId: string) {
    return this.prisma.documentGED.findMany({
      where: { dossierId },
      include: { uploadePar: { select: { id: true, nom: true } } },
      orderBy: { creeLe: 'desc' },
    });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private root() {
    return this.config.get('GED_STORAGE_PATH', './uploads');
  }

  async uploadPhoto(patientId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier photo requis');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Le fichier doit être une image');
    }

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient introuvable');

    const dir = join(this.root(), 'photos');
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}${extname(file.originalname) || '.jpg'}`;
    const path = join(dir, filename);
    await writeFile(path, file.buffer);

    return this.prisma.patient.update({
      where: { id: patientId },
      data: { photoProfil: path },
      select: {
        id: true,
        nom: true,
        prenom: true,
        photoProfil: true,
        numeroPasseport: true,
      },
    });
  }

  async getPhotoPath(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient?.photoProfil) return null;
    const mime = patient.photoProfil.toLowerCase().endsWith('.png')
      ? 'image/png'
      : patient.photoProfil.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    return { path: patient.photoProfil, mime };
  }
}

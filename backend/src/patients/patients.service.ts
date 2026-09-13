import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async uploadPhoto(patientId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier photo requis');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Le fichier doit être une image');
    }

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient introuvable');

    if (patient.photoProfil) {
      await this.storage.remove(patient.photoProfil);
    }

    const ref = await this.storage.put(
      'photos',
      `${patientId}${extname(file.originalname) || '.jpg'}`,
      file.buffer,
      file.mimetype,
    );

    return this.prisma.patient.update({
      where: { id: patientId },
      data: { photoProfil: ref },
      select: {
        id: true,
        nom: true,
        prenom: true,
        photoProfil: true,
        numeroPasseport: true,
      },
    });
  }

  async getPhoto(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient?.photoProfil) return null;
    const opened = await this.storage.open(patient.photoProfil);
    if (!opened) return null;
    const lower = patient.photoProfil.toLowerCase();
    const mime =
      opened.contentType ||
      (lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg');
    return { stream: opened.stream, mime };
  }
}

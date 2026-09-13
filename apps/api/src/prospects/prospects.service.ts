import { Injectable } from '@nestjs/common';
import { ProspectStatut } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProspectsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.prospect.findMany({ orderBy: { majLe: 'desc' } });
  }

  create(data: {
    nom: string;
    prenom?: string;
    telephone?: string;
    email?: string;
    sourceContact?: string;
    notes?: string;
  }) {
    return this.prisma.prospect.create({ data });
  }

  updateStatut(id: string, statut: ProspectStatut) {
    return this.prisma.prospect.update({ where: { id }, data: { statut } });
  }
}

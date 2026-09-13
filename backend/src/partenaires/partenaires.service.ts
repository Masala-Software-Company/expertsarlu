import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PartenairesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.partenaire.findMany({ orderBy: { nom: 'asc' } });
  }

  create(data: {
    nom: string;
    pays?: string;
    type?: string;
    contact?: string;
    email?: string;
    telephone?: string;
    notes?: string;
  }) {
    return this.prisma.partenaire.create({ data });
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
      notes?: string;
    },
  ) {
    const existing = await this.prisma.partenaire.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    return this.prisma.partenaire.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.partenaire.delete({ where: { id } });
    return { ok: true };
  }
}

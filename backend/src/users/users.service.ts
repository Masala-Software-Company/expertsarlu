import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';

/** Accès métier par rôle (aligné sur le seed RBAC). */
const ROLE_ACCESS: Record<
  RoleName,
  { label: string; description: string; modules: string[] }
> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Accès total : utilisateurs, tarifs, dossiers, audit, corbeille.',
    modules: [
      'dossiers',
      'cotation',
      'facturation',
      'logistique',
      'ged',
      'prospects',
      'partenaires',
      'audit',
      'users',
      'tarification',
      'notifications',
    ],
  },
  ASSISTANT_MANAGER: {
    label: 'Assistant Manager',
    description: 'Pilotage opérationnel : dossiers, cotation, facturation, logistique, audit.',
    modules: [
      'dossiers',
      'cotation',
      'facturation',
      'logistique',
      'ged',
      'notifications',
      'audit',
    ],
  },
  SUPPORT_CLIENT: {
    label: 'Support Client',
    description: 'Acquisition et suivi : dossiers, prospects, partenaires, GED.',
    modules: ['dossiers', 'prospects', 'partenaires', 'ged', 'notifications'],
  },
  CAISSE_ADMIN: {
    label: 'Caisse & Admin',
    description: 'Finance : lecture dossiers, cotation et facturation.',
    modules: ['dossiers', 'cotation', 'facturation', 'ged', 'notifications'],
  },
  PROTOCOLE: {
    label: 'Protocole',
    description: 'Logistique terrain : dossiers (lecture/maj), planning, GED.',
    modules: ['dossiers', 'logistique', 'ged', 'notifications'],
  },
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  listRoles() {
    return (Object.keys(ROLE_ACCESS) as RoleName[]).map((role) => ({
      role,
      ...ROLE_ACCESS[role],
    }));
  }

  list() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        creeLe: true,
      },
      orderBy: { nom: 'asc' },
    });
  }

  async create(data: {
    nom: string;
    email: string;
    password: string;
    role: RoleName;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Un compte avec cet e-mail existe déjà');
    }

    const hashPassword = await argon2.hash(data.password);
    return this.prisma.user.create({
      data: {
        nom: data.nom.trim(),
        email: data.email.toLowerCase().trim(),
        hashPassword,
        role: data.role,
      },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
      },
    });
  }

  async updateRole(id: string, role: RoleName, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      const count = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', actif: true },
      });
      if (count <= 1) {
        throw new BadRequestException(
          'Impossible de retirer le dernier Super Admin actif',
        );
      }
    }

    if (id === actor.id && role !== 'SUPER_ADMIN') {
      throw new BadRequestException(
        'Vous ne pouvez pas retirer votre propre rôle Super Admin',
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, nom: true, email: true, role: true, actif: true },
    });
  }

  async setActif(id: string, actif: boolean, actor: AuthUser) {
    if (id === actor.id && !actif) {
      throw new BadRequestException('Vous ne pouvez pas vous désactiver vous-même');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.role === 'SUPER_ADMIN' && !actif) {
      const count = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', actif: true },
      });
      if (count <= 1) {
        throw new BadRequestException(
          'Impossible de désactiver le dernier Super Admin actif',
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { actif },
      select: { id: true, nom: true, email: true, role: true, actif: true },
    });
  }

  async remove(id: string, actor: AuthUser) {
    if (id === actor.id) {
      throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.role === 'SUPER_ADMIN') {
      const count = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', actif: true },
      });
      if (count <= 1 && user.actif) {
        throw new BadRequestException(
          'Impossible de supprimer le dernier Super Admin actif',
        );
      }
    }

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });
    return { ok: true, id };
  }
}

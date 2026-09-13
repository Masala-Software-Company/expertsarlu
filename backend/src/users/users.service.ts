import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { extname } from 'path';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../auth/current-user.decorator';

const ROLE_ACCESS: Record<
  RoleName,
  { label: string; description: string; modules: string[] }
> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Accès total : équipe, tarifs, dossiers, audit, corbeille.',
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
    description: 'Logistique terrain : dossiers, planning, GED.',
    modules: ['dossiers', 'logistique', 'ged', 'notifications'],
  },
};

const userSelect = {
  id: true,
  nom: true,
  email: true,
  role: true,
  actif: true,
  photoProfil: true,
  creeLe: true,
  majLe: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  listRoles() {
    return (Object.keys(ROLE_ACCESS) as RoleName[]).map((role) => ({
      role,
      ...ROLE_ACCESS[role],
    }));
  }

  list() {
    return this.prisma.user.findMany({
      select: userSelect,
      orderBy: { nom: 'asc' },
    });
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('Membre introuvable');
    return user;
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
      select: userSelect,
    });
  }

  async updateProfile(
    id: string,
    data: { nom?: string; role?: RoleName; password?: string },
    actor: AuthUser,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Membre introuvable');

    const isSelf = actor.id === id;
    const isAdmin = actor.role === 'SUPER_ADMIN';
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException();
    }

    if (data.role && !isAdmin) {
      throw new ForbiddenException('Seul le Super Admin peut changer un rôle');
    }

    if (data.role && target.role === 'SUPER_ADMIN' && data.role !== 'SUPER_ADMIN') {
      const count = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', actif: true },
      });
      if (count <= 1) {
        throw new BadRequestException('Impossible de retirer le dernier Super Admin');
      }
    }

    if (isSelf && data.role && data.role !== 'SUPER_ADMIN' && actor.role === 'SUPER_ADMIN') {
      throw new BadRequestException('Vous ne pouvez pas retirer votre propre rôle Super Admin');
    }

    const hashPassword = data.password
      ? await argon2.hash(data.password)
      : undefined;

    const nom = data.nom?.trim();
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(nom ? { nom } : {}),
        ...(data.role ? { role: data.role } : {}),
        ...(hashPassword ? { hashPassword } : {}),
      },
      select: userSelect,
    });
  }

  async changePassword(
    id: string,
    input: { currentPassword?: string; newPassword: string },
    actor: AuthUser,
  ) {
    const isSelf = actor.id === id;
    const isAdmin = actor.role === 'SUPER_ADMIN';
    if (!isSelf && !isAdmin) throw new ForbiddenException();

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();

    if (isSelf) {
      if (!input.currentPassword) {
        throw new BadRequestException('Mot de passe actuel requis');
      }
      const ok = await argon2.verify(user.hashPassword, input.currentPassword);
      if (!ok) throw new BadRequestException('Mot de passe actuel incorrect');
    }

    if (!input.newPassword || input.newPassword.length < 8) {
      throw new BadRequestException('Nouveau mot de passe : min. 8 caractères');
    }

    await this.prisma.user.update({
      where: { id },
      data: { hashPassword: await argon2.hash(input.newPassword) },
    });
    return { ok: true };
  }

  async uploadPhoto(id: string, file: Express.Multer.File, actor: AuthUser) {
    if (actor.id !== id && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }
    if (!file?.buffer?.length || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Image requise');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();

    if (user.photoProfil) {
      await this.storage.remove(user.photoProfil);
    }

    const ref = await this.storage.put(
      'avatars',
      `${id}${extname(file.originalname) || '.jpg'}`,
      file.buffer,
      file.mimetype,
    );

    return this.prisma.user.update({
      where: { id },
      data: { photoProfil: ref },
      select: userSelect,
    });
  }

  async getPhoto(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user?.photoProfil) return null;
    const opened = await this.storage.open(user.photoProfil);
    if (!opened) return null;
    const lower = user.photoProfil.toLowerCase();
    const mime =
      opened.contentType ||
      (lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg');
    return { stream: opened.stream, mime };
  }

  async updateRole(id: string, role: RoleName, actor: AuthUser) {
    return this.updateProfile(id, { role }, actor);
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
      select: userSelect,
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

    if (user.photoProfil) await this.storage.remove(user.photoProfil);
    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });
    return { ok: true, id };
  }
}

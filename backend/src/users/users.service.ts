import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
    const hashPassword = await argon2.hash(data.password);
    return this.prisma.user.create({
      data: {
        nom: data.nom,
        email: data.email,
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

  async setActif(id: string, actif: boolean, actor: AuthUser) {
    if (id === actor.id && !actif) {
      throw new BadRequestException('Vous ne pouvez pas vous désactiver vous-même');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();
    return this.prisma.user.update({
      where: { id },
      data: { actif },
      select: { id: true, nom: true, email: true, role: true, actif: true },
    });
  }
}

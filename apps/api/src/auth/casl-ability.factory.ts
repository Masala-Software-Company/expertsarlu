import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './current-user.decorator';

export type AppAbility = MongoAbility<[string, string]>;

@Injectable()
export class CaslAbilityFactory {
  constructor(private prisma: PrismaService) {}

  async createForUser(user: AuthUser): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === 'SUPER_ADMIN') {
      can('manage', 'all');
      return build();
    }

    const perms = await this.prisma.permission.findMany({
      where: { role: user.role as never },
    });

    for (const p of perms) {
      can(p.action, p.module);
    }

    return build();
  }
}

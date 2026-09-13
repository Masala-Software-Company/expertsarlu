import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.actif) return null;
    const ok = await argon2.verify(user.hashPassword, password);
    if (!ok) return null;
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Identifiants invalides');

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.nom);
    return {
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hash, revoque: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!stored || !stored.user.actif) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoque: true },
    });

    return this.issueTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role,
      stored.user.nom,
    );
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const hash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash: hash },
        data: { revoque: true },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revoque: false },
        data: { revoque: true },
      });
    }
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nom: true, email: true, role: true, actif: true },
    });
    if (!user) throw new UnauthorizedException();
    const permissions = await this.prisma.permission.findMany({
      where: { role: user.role },
    });
    return { ...user, permissions };
  }

  private async issueTokens(
    id: string,
    email: string,
    role: string,
    nom: string,
  ) {
    const payload = { sub: id, email, role, nom };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'),
    });

    const refreshRaw = randomBytes(48).toString('hex');
    const ttl = this.config.get('JWT_REFRESH_TTL', '7d');
    const expiresAt = this.parseTtlDate(ttl);

    await this.prisma.refreshToken.create({
      data: {
        userId: id,
        tokenHash: this.hashToken(refreshRaw),
        expiresAt,
      },
    });

    return { accessToken, refreshToken: refreshRaw, expiresAt };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtlDate(ttl: string): Date {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    const n = match ? Number(match[1]) : 7;
    const unit = match?.[2] ?? 'd';
    const ms =
      unit === 's'
        ? n * 1000
        : unit === 'm'
          ? n * 60_000
          : unit === 'h'
            ? n * 3_600_000
            : n * 86_400_000;
    return new Date(Date.now() + ms);
  }
}

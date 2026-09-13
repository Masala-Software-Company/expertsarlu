import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuditInput = {
  userId?: string;
  action: string;
  tableCible: string;
  recordId?: string;
  ancienneValeur?: unknown;
  nouvelleValeur?: unknown;
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        tableCible: input.tableCible,
        recordId: input.recordId,
        ancienneValeur: input.ancienneValeur as never,
        nouvelleValeur: input.nouvelleValeur as never,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  }

  findAll(filters?: { tableCible?: string; userId?: string; limit?: number }) {
    return this.prisma.auditLog.findMany({
      where: {
        tableCible: filters?.tableCible,
        userId: filters?.userId,
      },
      include: { user: { select: { id: true, nom: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      take: filters?.limit ?? 100,
    });
  }
}

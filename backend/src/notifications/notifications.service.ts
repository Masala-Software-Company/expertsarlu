import { Injectable } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsService implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string | undefined;
    if (userId) client.join(`user:${userId}`);
  }

  async create(
    userId: string,
    type: string,
    titre: string,
    payload?: Record<string, unknown>,
  ) {
    const notif = await this.prisma.notification.create({
      data: { userId, type, titre, payload: payload as never },
    });
    this.server?.to(`user:${userId}`).emit('notification', notif);
    return notif;
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { creeLe: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { lu: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, lu: false },
      data: { lu: true },
    });
  }
}

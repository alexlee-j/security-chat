import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Inject, UnauthorizedException } from '@nestjs/common';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { REDIS_CLIENT } from '../../../infra/redis/redis.module';
import { ConversationService } from '../../conversation/conversation.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@WebSocketGateway({ namespace: '/ws', cors: true })
export class MessageGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly conversationService: ConversationService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  afterInit(): void {
    this.server.use(async (socket, next) => {
      try {
        const token = this.extractToken(socket);
        if (!token) {
          return next(new UnauthorizedException('Missing token'));
        }

        const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
          secret: this.configService.get<string>('JWT_SECRET', 'dev_secret_change_me'),
        });

        if (payload.type !== 'access') {
          return next(new UnauthorizedException('Invalid token type'));
        }

        const blacklisted = await this.redis.get(`token:blacklist:${payload.jti}`).catch(() => null);
        if (blacklisted) {
          return next(new UnauthorizedException('Token is revoked'));
        }

        socket.data.userId = payload.sub;
        return next();
      } catch {
        return next(new UnauthorizedException('Unauthorized'));
      }
    });
  }

  handleConnection(client: Socket): void {
    void client.join(this.userRoom(String(client.data.userId)));
    client.emit('system.connected', { status: 'ok', userId: client.data.userId });
  }

  handleDisconnect(_client: Socket): void {
    // Reserved for online state cleanup in Redis.
  }

  @SubscribeMessage('message.ping')
  ping(@ConnectedSocket() client: Socket, @MessageBody() payload: Record<string, unknown>): void {
    client.emit('message.pong', { ts: Date.now(), payload });
  }

  @SubscribeMessage('conversation.join')
  joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<void> {
    if (!payload?.conversationId) {
      client.emit('conversation.joined', { ok: false, reason: 'conversationId required' });
      return Promise.resolve();
    }

    return this.conversationService
      .assertMember(payload.conversationId, String(client.data.userId))
      .then(async () => {
        const room = this.conversationRoom(payload.conversationId as string);
        await client.join(room);
        client.emit('conversation.joined', { ok: true, conversationId: payload.conversationId });
      })
      .catch(() => {
        client.emit('conversation.joined', { ok: false, reason: 'forbidden' });
      });
  }

  @SubscribeMessage('conversation.typing.start')
  typingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<void> {
    return this.handleTyping(client, payload, true);
  }

  @SubscribeMessage('conversation.typing.stop')
  typingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<void> {
    return this.handleTyping(client, payload, false);
  }

  emitBurnTriggered(conversationId: string, messageId: string, triggeredAt: string): void {
    const room = this.conversationRoom(conversationId);
    this.server.to(room).emit('burn.triggered', {
      conversationId,
      messageId,
      triggeredAt,
    });
  }

  emitMessageSent(
    conversationId: string,
    payload: { messageId: string; messageIndex: string; senderId: string; createdAt: string },
  ): void {
    const room = this.conversationRoom(conversationId);
    this.server.to(room).emit('message.sent', {
      conversationId,
      ...payload,
    });
  }

  emitMessageDelivered(
    conversationId: string,
    payload: { maxMessageIndex: string; ackByUserId: string; deliveredCount: number; ackAt: string },
  ): void {
    const room = this.conversationRoom(conversationId);
    this.server.to(room).emit('message.delivered', {
      conversationId,
      ...payload,
    });
  }

  emitMessageRead(
    conversationId: string,
    payload: { maxMessageIndex: string; ackByUserId: string; readCount: number; ackAt: string },
  ): void {
    const room = this.conversationRoom(conversationId);
    this.server.to(room).emit('message.read', {
      conversationId,
      ...payload,
    });
  }

  emitConversationUpdated(
    userIds: string[],
    payload: { conversationId: string; reason: 'message.sent' | 'message.delivered' | 'message.read' | 'burn.triggered' },
  ): void {
    const eventPayload = {
      conversationId: payload.conversationId,
      reason: payload.reason,
      at: new Date().toISOString(),
    };
    for (const userId of userIds) {
      this.server.to(this.userRoom(userId)).emit('conversation.updated', eventPayload);
    }
  }

  private conversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private async handleTyping(
    client: Socket,
    payload: { conversationId?: string },
    isTyping: boolean,
  ): Promise<void> {
    if (!payload?.conversationId) {
      client.emit('conversation.typing.ack', { ok: false, reason: 'conversationId required' });
      return;
    }

    try {
      await this.conversationService.assertMember(payload.conversationId, String(client.data.userId));
      const room = this.conversationRoom(payload.conversationId);
      this.server.to(room).emit('conversation.typing', {
        conversationId: payload.conversationId,
        userId: String(client.data.userId),
        isTyping,
        at: new Date().toISOString(),
      });
      client.emit('conversation.typing.ack', { ok: true, conversationId: payload.conversationId, isTyping });
    } catch {
      client.emit('conversation.typing.ack', { ok: false, reason: 'forbidden' });
    }
  }

  private extractToken(socket: Socket): string | null {
    const authToken =
      typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : null;
    if (authToken) {
      return authToken.startsWith('Bearer ') ? authToken.slice(7) : authToken;
    }

    const header = socket.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }
}

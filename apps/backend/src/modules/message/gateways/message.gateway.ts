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
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { REDIS_CLIENT } from '../../../infra/redis/redis.module';
import { ConversationService } from '../../conversation/conversation.service';
import { WsAuthService } from '../../auth/ws-auth.service';

@WebSocketGateway({ namespace: '/ws', cors: true })
export class MessageGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly conversationService: ConversationService,
    private readonly wsAuthService: WsAuthService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  afterInit(): void {
    this.wsAuthService.attachNamespaceAuth(this.server);
  }

  handleConnection(client: Socket): void {
    void client.join(this.userRoom(String(client.data.userId)));
    client.emit('system.connected', { status: 'ok', userId: client.data.userId });
    void this.setUserOnline(String(client.data.userId));
  }

  handleDisconnect(client: Socket): void {
    void this.setUserOffline(String(client.data.userId));
  }

  private async setUserOnline(userId: string): Promise<void> {
    try {
      const connectionCount = await this.redis.incr(`online:connections:${userId}`);
      if (connectionCount === 1) {
        await this.redis.set(`online:${userId}`, '1');
        await this.broadcastUserStatus(userId, true);
      } else {
        await this.redis.set(`online:${userId}`, '1');
      }
    } catch (error) {
      console.error('Failed to set user online:', error);
    }
  }

  private async setUserOffline(userId: string): Promise<void> {
    try {
      const connectionCount = await this.redis.decr(`online:connections:${userId}`);
      if (connectionCount <= 0) {
        await this.redis.del(`online:connections:${userId}`);
        await this.redis.del(`online:${userId}`);
        await this.broadcastUserStatus(userId, false);
      } else {
        await this.redis.set(`online:${userId}`, '1');
      }
    } catch (error) {
      console.error('Failed to set user offline:', error);
    }
  }

  private async broadcastUserStatus(userId: string, isOnline: boolean): Promise<void> {
    const eventPayload = {
      userId,
      isOnline,
      at: new Date().toISOString(),
    };
    // 只向相关用户广播状态更新（好友和会话成员）
    try {
      // 获取用户的好友和会话成员
      const relatedUserIds = await this.getRelatedUserIds(userId);
      if (relatedUserIds.length > 0) {
        const userRooms = relatedUserIds.map(id => this.userRoom(id));
        this.server.to(userRooms).emit('user.status.updated', eventPayload);
      }
    } catch (error) {
      console.error('Failed to broadcast user status:', error);
    }
  }

  private async getRelatedUserIds(userId: string): Promise<string[]> {
    try {
      return await this.conversationService.listRelatedUserIds(userId);
    } catch (error) {
      console.error('Failed to get related user ids:', error);
      return [];
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const isOnline = await this.redis.get(`online:${userId}`);
      return isOnline === '1';
    } catch (error) {
      console.error('Failed to check user online status:', error);
      return false;
    }
  }

  async areUsersOnline(userIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    if (userIds.length === 0) {
      return result;
    }
    try {
      const keys = userIds.map((id) => `online:${id}`);
      const values = await this.redis.mget(...keys);
      userIds.forEach((userId, index) => {
        result.set(userId, values[index] === '1');
      });
    } catch (error) {
      console.error('Failed to batch check users online status:', error);
      userIds.forEach((userId) => {
        result.set(userId, false);
      });
    }
    return result;
  }

  @SubscribeMessage('message.ping')
  ping(@ConnectedSocket() client: Socket, @MessageBody() payload: Record<string, unknown>): void {
    client.emit('message.pong', { ts: Date.now(), payload });
  }

  /**
   * Legacy socket send path is intentionally disabled.
   * Supported clients MUST use REST `POST /message/send-v2` with
   * device-bound envelopes so we never bypass per-device ciphertext storage.
   */
  @SubscribeMessage('message.send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      recipientId: string;
      encryptedMessage: {
        messageType: number;
        body: string;  // Base64 编码的密文
      };
      isBurn?: boolean;
      burnDuration?: number;
    },
  ): Promise<void> {
    void data;
    client.emit('message.error', {
      code: 'LEGACY_TRANSPORT_DEPRECATED',
      message: 'WebSocket message.send is deprecated. Use REST /api/v1/message/send-v2.',
    });
  }

  /**
   * 请求历史加密消息
   */
  @SubscribeMessage('message.receive')
  async handleReceiveMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId?: string; conversationId?: string; limit?: number },
  ): Promise<void> {
    const userId = String(client.data.userId);

    if (!data.conversationId && !data.messageId) {
      client.emit('message.error', {
        code: 'INVALID_REQUEST',
        message: 'conversationId or messageId is required',
      });
      return;
    }

    // 客户端应从 REST API 获取历史消息
    // 此事件主要用于确认客户端已准备好接收消息
    client.emit('message.ready', {
      status: 'ready',
      timestamp: Date.now(),
    });
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

  emitMessageRevoked(
    conversationId: string,
    payload: { messageId: string; messageIndex: string; revokedByUserId: string; revokedAt: string },
  ): void {
    const room = this.conversationRoom(conversationId);
    this.server.to(room).emit('message.revoked', {
      conversationId,
      ...payload,
    });
  }

  emitConversationUpdated(
    userIds: string[],
    payload: { conversationId: string; reason: 'message.sent' | 'message.delivered' | 'message.read' | 'burn.triggered' | 'message.revoked' },
  ): void {
    const eventPayload = {
      conversationId: payload.conversationId,
      reason: payload.reason,
      at: new Date().toISOString(),
    };
    // Optimized: Batch emit to reduce network overhead
    if (userIds.length > 0) {
      const userRooms = userIds.map(userId => this.userRoom(userId));
      // Use server.to() with array of rooms for more efficient broadcasting
      this.server.to(userRooms).emit('conversation.updated', eventPayload);
    }
  }

  emitFriendRequestReceived(
    targetUserId: string,
    payload: { requesterUserId: string; requesterUsername: string; requesterAvatarUrl: string | null; remark: string | null; createdAt: string },
  ): void {
    const room = this.userRoom(targetUserId);
    this.server.to(room).emit('friend.request.received', payload);
  }

  emitFriendRequestResponded(
    requesterUserId: string,
    payload: { targetUserId: string; targetUsername: string; targetAvatarUrl: string | null; accepted: boolean; respondedAt: string },
  ): void {
    const room = this.userRoom(requesterUserId);
    this.server.to(room).emit('friend.request.responded', payload);
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
}

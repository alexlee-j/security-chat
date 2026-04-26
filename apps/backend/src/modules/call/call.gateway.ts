import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { CallService } from './call.service';
import { WsAuthService } from '../auth/ws-auth.service';

type CallSocket = Socket & {
  data: {
    userId?: string;
    deviceId?: string;
  };
};

@WebSocketGateway({ namespace: '/ws', cors: true })
export class CallGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;
  private readonly timeoutTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly configService: ConfigService,
    private readonly wsAuthService: WsAuthService,
    private readonly callService: CallService,
  ) {}

  afterInit(): void {
    this.wsAuthService.attachNamespaceAuth(this.server);
  }

  handleConnection(client: CallSocket): void {
    const userId = String(client.data.userId);
    const deviceId = String(client.data.deviceId ?? client.id);
    void client.join(this.userRoom(userId));
    void client.join(this.deviceRoom(userId, deviceId));
    void this.callService.registerOnlineDevice(userId, deviceId);
  }

  handleDisconnect(client: CallSocket): void {
    const userId = String(client.data.userId ?? '');
    const deviceId = String(client.data.deviceId ?? '');
    if (userId && deviceId) {
      void this.callService.unregisterOnlineDevice(userId, deviceId);
    }
  }

  @SubscribeMessage('call.invite')
  async invite(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<void> {
    if (!payload?.conversationId) {
      client.emit('call.error', { code: 'INVALID_REQUEST', message: 'conversationId is required' });
      return;
    }
    try {
      const result = await this.callService.invite(this.actor(client), { conversationId: payload.conversationId });
      if (!result.ok || !result.session) {
        client.emit('call.failed', { reason: result.reason, conversationId: payload.conversationId });
        return;
      }
      client.emit('call.invite.ack', {
        ok: true,
        callId: result.session.callId,
        conversationId: result.session.conversationId,
        calleeDeviceIds: result.calleeDeviceIds,
      });
      for (const deviceId of result.calleeDeviceIds ?? []) {
        this.server.to(this.deviceRoom(result.session.calleeUserId, deviceId)).emit('call.invited', this.publicSession(result.session));
      }
      this.scheduleTimeout(result.session.callId);
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('call.accept')
  async accept(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() payload: { callId?: string },
  ): Promise<void> {
    if (!payload?.callId) {
      client.emit('call.error', { code: 'INVALID_REQUEST', message: 'callId is required' });
      return;
    }
    const result = await this.callService.accept(this.actor(client), { callId: payload.callId });
    if (!result.ok || !result.session) {
      client.emit(result.reason === 'answered_elsewhere' ? 'call.answered_elsewhere' : 'call.error', {
        callId: payload.callId,
        reason: result.reason,
      });
      return;
    }

    this.clearTimeoutTimer(result.session.callId);
    this.scheduleTimeout(result.session.callId, this.connectTimeoutSeconds());
    this.server.to(this.deviceRoom(result.session.callerUserId, result.session.callerDeviceId)).emit('call.accepted', this.publicSession(result.session));
    for (const deviceId of result.session.calleeDeviceIds.filter((id) => id !== result.session?.acceptedDeviceId)) {
      this.server.to(this.deviceRoom(result.session.calleeUserId, deviceId)).emit('call.answered_elsewhere', {
        callId: result.session.callId,
        conversationId: result.session.conversationId,
      });
    }
  }

  @SubscribeMessage('call.reject')
  async reject(@ConnectedSocket() client: CallSocket, @MessageBody() payload: { callId?: string }): Promise<void> {
    await this.endWithService(client, payload, 'reject');
  }

  @SubscribeMessage('call.cancel')
  async cancel(@ConnectedSocket() client: CallSocket, @MessageBody() payload: { callId?: string }): Promise<void> {
    await this.endWithService(client, payload, 'cancel');
  }

  @SubscribeMessage('call.hangup')
  async hangup(@ConnectedSocket() client: CallSocket, @MessageBody() payload: { callId?: string }): Promise<void> {
    await this.endWithService(client, payload, 'hangup');
  }

  @SubscribeMessage('call.connected')
  async connected(@ConnectedSocket() client: CallSocket, @MessageBody() payload: { callId?: string }): Promise<void> {
    if (!payload?.callId) {
      client.emit('call.error', { code: 'INVALID_REQUEST', message: 'callId is required' });
      return;
    }
    const session = await this.callService.markConnected(this.actor(client), { callId: payload.callId });
    this.emitToParticipants(session, 'call.connected', this.publicSession(session));
  }

  @SubscribeMessage('call.offer')
  async offer(@ConnectedSocket() client: CallSocket, @MessageBody() payload: { callId?: string; sdp?: string }): Promise<void> {
    await this.relay(client, 'call.offer', payload);
  }

  @SubscribeMessage('call.answer')
  async answer(@ConnectedSocket() client: CallSocket, @MessageBody() payload: { callId?: string; sdp?: string }): Promise<void> {
    await this.relay(client, 'call.answer', payload);
  }

  @SubscribeMessage('call.ice-candidate')
  async iceCandidate(@ConnectedSocket() client: CallSocket, @MessageBody() payload: { callId?: string; candidate?: unknown }): Promise<void> {
    await this.relay(client, 'call.ice-candidate', payload);
  }

  private async relay(client: CallSocket, event: string, payload: { callId?: string; sdp?: string; candidate?: unknown }): Promise<void> {
    if (!payload?.callId) {
      client.emit('call.error', { code: 'INVALID_REQUEST', message: 'callId is required' });
      return;
    }
    try {
      const target = await this.callService.assertRelayAllowed(this.actor(client), payload.callId);
      this.server.to(this.deviceRoom(target.targetUserId, target.targetDeviceId)).emit(event, {
        callId: payload.callId,
        conversationId: target.session.conversationId,
        fromUserId: String(client.data.userId),
        fromDeviceId: String(client.data.deviceId),
        sdp: payload.sdp,
        candidate: payload.candidate,
      });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  private async endWithService(
    client: CallSocket,
    payload: { callId?: string },
    action: 'reject' | 'cancel' | 'hangup',
  ): Promise<void> {
    if (!payload?.callId) {
      client.emit('call.error', { code: 'INVALID_REQUEST', message: 'callId is required' });
      return;
    }
    try {
      const session = await this.callService[action](this.actor(client), { callId: payload.callId });
      if (session) {
        this.clearTimeoutTimer(session.callId);
        this.emitToParticipants(session, 'call.ended', {
          callId: session.callId,
          conversationId: session.conversationId,
          reason: action,
        });
      }
    } catch (error) {
      this.emitError(client, error);
    }
  }

  private scheduleTimeout(callId: string, seconds = this.ringTimeoutSeconds()): void {
    this.clearTimeoutTimer(callId);
    const timer = setTimeout(async () => {
      const session = await this.callService.timeout(callId).catch(() => null);
      if (session) {
        this.emitToParticipants(session, 'call.timeout', {
          callId: session.callId,
          conversationId: session.conversationId,
        });
      }
      this.clearTimeoutTimer(callId);
    }, Math.max(1, seconds) * 1000);
    this.timeoutTimers.set(callId, timer);
  }

  private ringTimeoutSeconds(): number {
    return Number(this.configService.get<string>('CALL_RING_TIMEOUT_SECONDS', '30'));
  }

  private connectTimeoutSeconds(): number {
    return Number(this.configService.get<string>('CALL_CONNECT_TIMEOUT_SECONDS', '45'));
  }

  private clearTimeoutTimer(callId: string): void {
    const timer = this.timeoutTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(callId);
    }
  }

  private emitToParticipants(session: { callerUserId: string; callerDeviceId: string; calleeUserId: string; acceptedDeviceId?: string; calleeDeviceIds: string[] }, event: string, payload: object): void {
    this.server.to(this.deviceRoom(session.callerUserId, session.callerDeviceId)).emit(event, payload);
    const calleeTargets = session.acceptedDeviceId ? [session.acceptedDeviceId] : session.calleeDeviceIds;
    for (const deviceId of calleeTargets) {
      this.server.to(this.deviceRoom(session.calleeUserId, deviceId)).emit(event, payload);
    }
  }

  private actor(client: CallSocket): { userId: string; deviceId: string } {
    return {
      userId: String(client.data.userId),
      deviceId: String(client.data.deviceId ?? client.id),
    };
  }

  private publicSession(session: object): object {
    return session;
  }

  private emitError(client: CallSocket, error: unknown): void {
    client.emit('call.error', {
      code: 'CALL_SIGNALING_ERROR',
      message: error instanceof Error ? error.message : 'Call signaling failed',
    });
  }

  private userRoom(userId: string): string {
    return `call:user:${userId}`;
  }

  private deviceRoom(userId: string, deviceId: string): string {
    return `call:device:${userId}:${deviceId}`;
  }
}

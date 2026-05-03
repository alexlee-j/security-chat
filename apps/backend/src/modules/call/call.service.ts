import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { ConversationService } from '../conversation/conversation.service';
import { CallHistoryService } from './call-history.service';
import type {
  ActiveCallSession,
  CallAcceptResult,
  CallInviteResult,
  CallParticipant,
  CallOutcome,
  RelayTarget,
} from './types/call.types';

@Injectable()
export class CallService {
  constructor(
    private readonly conversationService: ConversationService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly callHistoryService: CallHistoryService,
    private readonly configService: ConfigService,
  ) {}

  async registerOnlineDevice(userId: string, deviceId: string): Promise<void> {
    await this.redis.sadd(this.onlineDevicesKey(userId), deviceId);
    await this.redis.expire(this.onlineDevicesKey(userId), 120);
  }

  async unregisterOnlineDevice(userId: string, deviceId: string): Promise<void> {
    await this.redis.srem(this.onlineDevicesKey(userId), deviceId);
  }

  async invite(actor: Required<CallParticipant>, dto: { conversationId: string }): Promise<CallInviteResult> {
    const { calleeUserId } = await this.resolveDirectCall(actor.userId, dto.conversationId);
    const calleeDeviceIds = await this.redis.smembers(this.onlineDevicesKey(calleeUserId));
    if (calleeDeviceIds.length === 0) {
      if (this.configService.get<string>('CALL_CREATE_OFFLINE_HISTORY', 'true') !== 'false') {
        await this.callHistoryService.createRecord({
          conversationId: dto.conversationId,
          callerUserId: actor.userId,
          callerDeviceId: actor.deviceId,
          calleeUserId,
          outcome: 'offline',
          startedAt: new Date(),
          endedAt: new Date(),
          createdByUserId: actor.userId,
        });
      }
      return { ok: false, reason: 'callee_offline' };
    }

    const now = new Date().toISOString();
    const session: ActiveCallSession = {
      callId: randomUUID(),
      conversationId: dto.conversationId,
      callerUserId: actor.userId,
      callerDeviceId: actor.deviceId,
      calleeUserId,
      calleeDeviceIds,
      status: 'ringing',
      createdAt: now,
    };
    await this.saveSession(session, this.ringTimeoutSeconds());
    return { ok: true, session, calleeDeviceIds };
  }

  async accept(actor: Required<CallParticipant>, dto: { callId: string }): Promise<CallAcceptResult> {
    const session = await this.getSession(dto.callId);
    if (!session) {
      return { ok: false, reason: 'not_found' };
    }
    if (actor.userId !== session.calleeUserId || !session.calleeDeviceIds.includes(actor.deviceId)) {
      return { ok: false, reason: 'forbidden' };
    }
    const lock = await (this.redis.set as unknown as (...args: string[]) => Promise<string | null>)(
      this.acceptLockKey(dto.callId),
      actor.deviceId,
      'NX',
      'EX',
      String(this.connectTimeoutSeconds()),
    );
    if (lock !== 'OK') {
      return { ok: false, reason: 'answered_elsewhere' };
    }
    const next: ActiveCallSession = {
      ...session,
      acceptedDeviceId: actor.deviceId,
      acceptedAt: new Date().toISOString(),
      status: 'connecting',
    };
    await this.saveSession(next, this.connectTimeoutSeconds());
    return { ok: true, session: next };
  }

  async reject(actor: Required<CallParticipant>, dto: { callId: string }): Promise<ActiveCallSession | null> {
    const session = await this.getSession(dto.callId);
    if (!session) {
      return null;
    }
    if (actor.userId !== session.calleeUserId) {
      throw new ForbiddenException('Only callee can reject this call');
    }
    await this.terminalRecord(session, 'rejected', actor.userId);
    await this.clearSession(dto.callId);
    return session;
  }

  async cancel(actor: Required<CallParticipant>, dto: { callId: string }): Promise<ActiveCallSession | null> {
    const session = await this.getSession(dto.callId);
    if (!session) {
      return null;
    }
    if (actor.userId !== session.callerUserId) {
      throw new ForbiddenException('Only caller can cancel this call');
    }
    await this.terminalRecord(session, 'canceled', actor.userId);
    await this.clearSession(dto.callId);
    return session;
  }

  async hangup(actor: Required<CallParticipant>, dto: { callId: string }): Promise<ActiveCallSession | null> {
    const session = await this.getSession(dto.callId);
    if (!session) {
      return null;
    }
    this.assertParticipant(actor, session);
    await this.terminalRecord(session, session.acceptedAt ? 'completed' : 'canceled', actor.userId);
    await this.clearSession(dto.callId);
    return session;
  }

  async timeout(callId: string): Promise<ActiveCallSession | null> {
    const session = await this.getSession(callId);
    if (!session) {
      return null;
    }
    await this.terminalRecord(session, session.status === 'ringing' ? 'missed' : 'failed', session.callerUserId);
    await this.clearSession(callId);
    return session;
  }

  async markConnected(actor: Required<CallParticipant>, dto: { callId: string }): Promise<ActiveCallSession> {
    const session = await this.getExistingSession(dto.callId);
    this.assertParticipant(actor, session);
    const next: ActiveCallSession = {
      ...session,
      status: 'connected',
      connectedAt: session.connectedAt ?? new Date().toISOString(),
    };
    await this.saveSession(next, this.activeCallTtlSeconds());
    return next;
  }

  async assertRelayAllowed(actor: Required<CallParticipant>, callId: string): Promise<RelayTarget> {
    const session = await this.getExistingSession(callId);
    if (!session.acceptedDeviceId) {
      throw new ForbiddenException('Call has not been accepted');
    }
    if (actor.userId === session.callerUserId && actor.deviceId === session.callerDeviceId) {
      return {
        targetUserId: session.calleeUserId,
        targetDeviceId: session.acceptedDeviceId,
        session,
      };
    }
    if (actor.userId === session.calleeUserId && actor.deviceId === session.acceptedDeviceId) {
      return {
        targetUserId: session.callerUserId,
        targetDeviceId: session.callerDeviceId,
        session,
      };
    }
    throw new ForbiddenException('User is not an active call participant');
  }

  async getSession(callId: string): Promise<ActiveCallSession | null> {
    const raw = await this.redis.get(this.sessionKey(callId));
    return raw ? JSON.parse(raw) as ActiveCallSession : null;
  }

  private async resolveDirectCall(callerUserId: string, conversationId: string): Promise<{ calleeUserId: string }> {
    await this.conversationService.assertMember(conversationId, callerUserId);
    const conversation = await this.conversationService.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.type !== 1) {
      throw new BadRequestException('Voice calls support direct conversations only');
    }
    const members = await this.conversationService.listMembers(conversationId);
    const callee = members.find((member) => member.userId !== callerUserId);
    if (!callee) {
      throw new BadRequestException('Direct conversation peer not found');
    }
    return { calleeUserId: callee.userId };
  }

  private async getExistingSession(callId: string): Promise<ActiveCallSession> {
    const session = await this.getSession(callId);
    if (!session) {
      throw new NotFoundException('Call session not found');
    }
    return session;
  }

  private assertParticipant(actor: Required<CallParticipant>, session: ActiveCallSession): void {
    const caller = actor.userId === session.callerUserId && actor.deviceId === session.callerDeviceId;
    const acceptedCallee = actor.userId === session.calleeUserId && actor.deviceId === session.acceptedDeviceId;
    if (!caller && !acceptedCallee) {
      throw new ForbiddenException('User is not an active call participant');
    }
  }

  private async terminalRecord(session: ActiveCallSession, outcome: CallOutcome, createdByUserId: string): Promise<void> {
    await this.callHistoryService.createRecord({
      conversationId: session.conversationId,
      callerUserId: session.callerUserId,
      callerDeviceId: session.callerDeviceId,
      calleeUserId: session.calleeUserId,
      acceptedDeviceId: session.acceptedDeviceId ?? null,
      outcome,
      startedAt: session.createdAt,
      acceptedAt: session.acceptedAt ?? null,
      endedAt: new Date(),
      createdByUserId,
    });
  }

  private async saveSession(session: ActiveCallSession, ttlSeconds: number): Promise<void> {
    await (this.redis.set as unknown as (...args: string[]) => Promise<string | null>)(
      this.sessionKey(session.callId),
      JSON.stringify(session),
      'EX',
      String(ttlSeconds),
    );
  }

  private async clearSession(callId: string): Promise<void> {
    await this.redis.del(this.sessionKey(callId), this.acceptLockKey(callId));
  }

  private sessionKey(callId: string): string {
    return `call:session:${callId}`;
  }

  private acceptLockKey(callId: string): string {
    return `call:accept:${callId}`;
  }

  private onlineDevicesKey(userId: string): string {
    return `call:online-devices:${userId}`;
  }

  private ringTimeoutSeconds(): number {
    return Number(this.configService.get<string>('CALL_RING_TIMEOUT_SECONDS', '30'));
  }

  private connectTimeoutSeconds(): number {
    return Number(this.configService.get<string>('CALL_CONNECT_TIMEOUT_SECONDS', '45'));
  }

  private activeCallTtlSeconds(): number {
    return Number(this.configService.get<string>('CALL_ACTIVE_TTL_SECONDS', '86400'));
  }
}

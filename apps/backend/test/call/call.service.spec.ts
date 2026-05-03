import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { ConversationService } from '../../src/modules/conversation/conversation.service';
import { CallHistoryService } from '../../src/modules/call/call-history.service';
import { CallRecord } from '../../src/modules/call/entities/call-record.entity';
import { CallService } from '../../src/modules/call/call.service';

const conversationId = '11111111-1111-4111-8111-111111111111';
const callerUserId = '22222222-2222-4222-8222-222222222222';
const callerDeviceId = '33333333-3333-4333-8333-333333333333';
const calleeUserId = '44444444-4444-4444-8444-444444444444';
const calleeDeviceA = '55555555-5555-4555-8555-555555555555';
const calleeDeviceB = '66666666-6666-4666-8666-666666666666';

describe('CallService', () => {
  let redisStore: Map<string, string>;
  let redisSets: Map<string, Set<string>>;
  let redis: jest.Mocked<Redis>;
  let conversationService: jest.Mocked<ConversationService>;
  let callHistoryService: jest.Mocked<CallHistoryService>;
  let configService: jest.Mocked<ConfigService>;
  let service: CallService;

  const createService = (conversationType = 1): CallService => {
    redisStore = new Map();
    redisSets = new Map();
    redis = {
      get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
      set: jest.fn(async (key: string, value: string, ...args: string[]) => {
        if (args.includes('NX') && redisStore.has(key)) {
          return null;
        }
        redisStore.set(key, value);
        return 'OK';
      }),
      del: jest.fn(async (...keys: string[]) => {
        let deleted = 0;
        for (const key of keys) {
          if (redisStore.delete(key)) deleted++;
          if (redisSets.delete(key)) deleted++;
        }
        return deleted;
      }),
      sadd: jest.fn(async (key: string, ...members: string[]) => {
        const set = redisSets.get(key) ?? new Set<string>();
        let added = 0;
        for (const member of members) {
          if (!set.has(member)) added++;
          set.add(member);
        }
        redisSets.set(key, set);
        return added;
      }),
      srem: jest.fn(async (key: string, ...members: string[]) => {
        const set = redisSets.get(key) ?? new Set<string>();
        let removed = 0;
        for (const member of members) {
          if (set.delete(member)) removed++;
        }
        redisSets.set(key, set);
        return removed;
      }),
      smembers: jest.fn(async (key: string) => Array.from(redisSets.get(key) ?? [])),
      expire: jest.fn(async () => 1),
    } as unknown as jest.Mocked<Redis>;

    conversationService = {
      assertMember: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({ id: conversationId, type: conversationType }),
      listMembers: jest.fn().mockResolvedValue([
        { userId: callerUserId, role: 0 },
        { userId: calleeUserId, role: 0 },
      ]),
    } as unknown as jest.Mocked<ConversationService>;
    callHistoryService = {
      createRecord: jest.fn().mockResolvedValue({ id: 'call-record-1' } as CallRecord),
    } as unknown as jest.Mocked<CallHistoryService>;
    configService = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          CALL_RING_TIMEOUT_SECONDS: '30',
          CALL_CONNECT_TIMEOUT_SECONDS: '45',
          CALL_ACTIVE_TTL_SECONDS: '86400',
          CALL_CREATE_OFFLINE_HISTORY: 'true',
        };
        return values[key] ?? fallback;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    return new CallService(conversationService, redis, callHistoryService, configService);
  };

  beforeEach(() => {
    service = createService();
  });

  it('rejects group conversation call invites', async () => {
    service = createService(2);

    await expect(service.invite({
      userId: callerUserId,
      deviceId: callerDeviceId,
    }, { conversationId })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails immediately and creates optional history when callee has no online devices', async () => {
    const result = await service.invite({
      userId: callerUserId,
      deviceId: callerDeviceId,
    }, { conversationId });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('callee_offline');
    expect(callHistoryService.createRecord).toHaveBeenCalledWith(expect.objectContaining({
      conversationId,
      callerUserId,
      calleeUserId,
      outcome: 'offline',
    }));
  });

  it('creates ringing sessions for every online callee device', async () => {
    await service.registerOnlineDevice(calleeUserId, calleeDeviceA);
    await service.registerOnlineDevice(calleeUserId, calleeDeviceB);

    const result = await service.invite({
      userId: callerUserId,
      deviceId: callerDeviceId,
    }, { conversationId });

    expect(result.ok).toBe(true);
    expect(result.calleeDeviceIds).toEqual([calleeDeviceA, calleeDeviceB]);
    expect(result.session?.status).toBe('ringing');
    expect(result.session?.callerDeviceId).toBe(callerDeviceId);
  });

  it('enforces first accepted callee device wins', async () => {
    await service.registerOnlineDevice(calleeUserId, calleeDeviceA);
    await service.registerOnlineDevice(calleeUserId, calleeDeviceB);
    const invite = await service.invite({ userId: callerUserId, deviceId: callerDeviceId }, { conversationId });
    const callId = invite.session?.callId as string;

    const accepted = await service.accept({ userId: calleeUserId, deviceId: calleeDeviceA }, { callId });
    const late = await service.accept({ userId: calleeUserId, deviceId: calleeDeviceB }, { callId });

    expect(accepted.ok).toBe(true);
    expect(accepted.session?.acceptedDeviceId).toBe(calleeDeviceA);
    expect(late.ok).toBe(false);
    expect(late.reason).toBe('answered_elsewhere');
  });

  it('authorizes WebRTC relay only for active call participants', async () => {
    await service.registerOnlineDevice(calleeUserId, calleeDeviceA);
    const invite = await service.invite({ userId: callerUserId, deviceId: callerDeviceId }, { conversationId });
    const callId = invite.session?.callId as string;
    await service.accept({ userId: calleeUserId, deviceId: calleeDeviceA }, { callId });

    const callerRelay = await service.assertRelayAllowed({ userId: callerUserId, deviceId: callerDeviceId }, callId);
    await expect(service.assertRelayAllowed({ userId: '99999999-9999-4999-8999-999999999999', deviceId: callerDeviceId }, callId))
      .rejects.toBeInstanceOf(ForbiddenException);

    expect(callerRelay.targetUserId).toBe(calleeUserId);
    expect(callerRelay.targetDeviceId).toBe(calleeDeviceA);
  });

  it('keeps connected call sessions beyond the connection timeout', async () => {
    await service.registerOnlineDevice(calleeUserId, calleeDeviceA);
    const invite = await service.invite({ userId: callerUserId, deviceId: callerDeviceId }, { conversationId });
    const callId = invite.session?.callId as string;
    await service.accept({ userId: calleeUserId, deviceId: calleeDeviceA }, { callId });
    redis.set.mockClear();

    await service.markConnected({ userId: callerUserId, deviceId: callerDeviceId }, { callId });

    expect(redis.set).toHaveBeenCalledWith(
      `call:session:${callId}`,
      expect.any(String),
      'EX',
      '86400',
    );
  });

  it('records missed outcome and clears ringing session on timeout', async () => {
    await service.registerOnlineDevice(calleeUserId, calleeDeviceA);
    const invite = await service.invite({ userId: callerUserId, deviceId: callerDeviceId }, { conversationId });
    const callId = invite.session?.callId as string;

    const timedOut = await service.timeout(callId);

    expect(timedOut?.callId).toBe(callId);
    expect(callHistoryService.createRecord).toHaveBeenCalledWith(expect.objectContaining({
      conversationId,
      callerUserId,
      calleeUserId,
      outcome: 'missed',
    }));
    await expect(service.getSession(callId)).resolves.toBeNull();
  });
});

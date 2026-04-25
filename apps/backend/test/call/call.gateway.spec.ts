import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { Socket } from 'socket.io';
import { CallGateway } from '../../src/modules/call/call.gateway';
import { CallService } from '../../src/modules/call/call.service';

describe('CallGateway', () => {
  it('rejects unauthorized call namespace sockets before call events are handled', async () => {
    let middleware: ((socket: Socket, next: (error?: unknown) => void) => Promise<void>) | undefined;
    const gateway = new CallGateway({} as JwtService, {} as ConfigService, {} as Redis, {} as CallService);
    (gateway as any).server = {
      use: jest.fn((handler) => {
        middleware = handler;
      }),
    };

    gateway.afterInit();

    const next = jest.fn();
    await middleware?.({
      handshake: {
        auth: {},
        headers: {},
      },
      data: {},
    } as unknown as Socket, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Missing token',
    }));
  });

  it('emits answered-elsewhere to losing callee devices when first accept wins', async () => {
    jest.useFakeTimers();
    try {
      const callService = {
        accept: jest.fn()
          .mockResolvedValueOnce({
            ok: true,
            session: {
              callId: 'call-1',
              conversationId: 'conversation-1',
              callerUserId: 'caller',
              callerDeviceId: 'caller-device',
              calleeUserId: 'callee',
              acceptedDeviceId: 'callee-device-a',
              calleeDeviceIds: ['callee-device-a', 'callee-device-b'],
            },
          }),
      } as unknown as jest.Mocked<CallService>;

      const configService = {
        get: jest.fn((key: string, fallback?: string) => key === 'CALL_CONNECT_TIMEOUT_SECONDS' ? '45' : fallback),
      } as unknown as ConfigService;
      const gateway = new CallGateway({} as JwtService, configService, {} as Redis, callService);
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      (gateway as any).server = { to, emit };
      const client = { data: { userId: 'callee', deviceId: 'callee-device-a' }, emit: jest.fn() } as unknown as Socket;

      await gateway.accept(client, { callId: 'call-1' });

      expect(to).toHaveBeenCalledWith('call:device:caller:caller-device');
      expect(emit).toHaveBeenCalledWith('call.accepted', expect.objectContaining({ callId: 'call-1' }));
      expect(to).toHaveBeenCalledWith('call:device:callee:callee-device-b');
      expect(emit).toHaveBeenCalledWith('call.answered_elsewhere', expect.objectContaining({ callId: 'call-1' }));
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('schedules a connection timeout after an accepted call', async () => {
    jest.useFakeTimers();
    try {
      const callService = {
        accept: jest.fn().mockResolvedValue({
          ok: true,
          session: {
            callId: 'call-1',
            conversationId: 'conversation-1',
            callerUserId: 'caller',
            callerDeviceId: 'caller-device',
            calleeUserId: 'callee',
            acceptedDeviceId: 'callee-device-a',
            calleeDeviceIds: ['callee-device-a'],
          },
        }),
        timeout: jest.fn().mockResolvedValue({
          callId: 'call-1',
          conversationId: 'conversation-1',
          callerUserId: 'caller',
          callerDeviceId: 'caller-device',
          calleeUserId: 'callee',
          acceptedDeviceId: 'callee-device-a',
          calleeDeviceIds: ['callee-device-a'],
        }),
      } as unknown as jest.Mocked<CallService>;
      const configService = {
        get: jest.fn((key: string, fallback?: string) => key === 'CALL_CONNECT_TIMEOUT_SECONDS' ? '2' : fallback),
      } as unknown as ConfigService;

      const gateway = new CallGateway({} as JwtService, configService, {} as Redis, callService);
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      (gateway as any).server = { to, emit };
      const client = { data: { userId: 'callee', deviceId: 'callee-device-a' }, emit: jest.fn() } as unknown as Socket;

      await gateway.accept(client, { callId: 'call-1' });
      await jest.advanceTimersByTimeAsync(2_000);

      expect(callService.timeout).toHaveBeenCalledWith('call-1');
      expect(emit).toHaveBeenCalledWith('call.timeout', expect.objectContaining({ callId: 'call-1' }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('relays SDP and ICE payloads only after service authorization', async () => {
    const callService = {
      assertRelayAllowed: jest.fn().mockResolvedValue({
        targetUserId: 'callee',
        targetDeviceId: 'callee-device',
        session: {
          conversationId: 'conversation-1',
        },
      }),
    } as unknown as jest.Mocked<CallService>;

    const gateway = new CallGateway({} as JwtService, {} as ConfigService, {} as Redis, callService);
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    (gateway as any).server = { to, emit };
    const client = { data: { userId: 'caller', deviceId: 'caller-device' }, emit: jest.fn() } as unknown as Socket;

    await gateway.offer(client, { callId: 'call-1', sdp: 'offer-sdp' });
    await gateway.iceCandidate(client, { callId: 'call-1', candidate: { candidate: 'candidate:1' } });

    expect(callService.assertRelayAllowed).toHaveBeenCalledTimes(2);
    expect(to).toHaveBeenCalledWith('call:device:callee:callee-device');
    expect(emit).toHaveBeenCalledWith('call.offer', expect.objectContaining({ sdp: 'offer-sdp' }));
    expect(emit).toHaveBeenCalledWith('call.ice-candidate', expect.objectContaining({ candidate: { candidate: 'candidate:1' } }));
  });
});

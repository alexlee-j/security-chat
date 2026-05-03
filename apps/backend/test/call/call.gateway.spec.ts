import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { CallGateway } from '../../src/modules/call/call.gateway';
import { CallService } from '../../src/modules/call/call.service';
import { WsAuthService } from '../../src/modules/auth/ws-auth.service';

describe('CallGateway', () => {
  it('attaches namespace auth middleware during initialization', () => {
    const wsAuthService = {
      attachNamespaceAuth: jest.fn(),
    } as unknown as WsAuthService;
    const gateway = new CallGateway({} as ConfigService, wsAuthService, {} as CallService);
    const server = {} as any;
    (gateway as any).server = server;

    gateway.afterInit();

    expect(wsAuthService.attachNamespaceAuth).toHaveBeenCalledWith(server);
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
      const gateway = new CallGateway(configService, {} as WsAuthService, callService);
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

      const gateway = new CallGateway(configService, {} as WsAuthService, callService);
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

  it('clears the connection timeout once an answer is relayed', async () => {
    jest.useFakeTimers();
    try {
      const callService = {
        assertRelayAllowed: jest.fn().mockResolvedValue({
          targetUserId: 'caller',
          targetDeviceId: 'caller-device',
          session: {
            conversationId: 'conversation-1',
          },
        }),
        markConnected: jest.fn().mockResolvedValue({
          callId: 'call-1',
          conversationId: 'conversation-1',
          callerUserId: 'caller',
          callerDeviceId: 'caller-device',
          calleeUserId: 'callee',
          acceptedDeviceId: 'callee-device-a',
          calleeDeviceIds: ['callee-device-a'],
          status: 'connected',
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

      const gateway = new CallGateway(configService, {} as WsAuthService, callService);
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      (gateway as any).server = { to, emit };
      const callee = { data: { userId: 'callee', deviceId: 'callee-device-a' }, emit: jest.fn() } as unknown as Socket;

      (gateway as any).scheduleTimeout('call-1', 2);
      await gateway.answer(callee, { callId: 'call-1', sdp: 'answer-sdp' });
      await jest.advanceTimersByTimeAsync(2_000);

      expect(callService.timeout).not.toHaveBeenCalled();
      expect(callService.markConnected).toHaveBeenCalledWith({ userId: 'callee', deviceId: 'callee-device-a' }, { callId: 'call-1' });
      expect(emit).toHaveBeenCalledWith('call.connected', expect.objectContaining({ callId: 'call-1' }));
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

    const gateway = new CallGateway({} as ConfigService, {} as WsAuthService, callService);
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

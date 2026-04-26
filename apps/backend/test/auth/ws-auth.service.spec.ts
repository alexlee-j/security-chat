import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../../src/modules/auth/ws-auth.service';

describe('WsAuthService', () => {
  function createService(options?: { allowLegacy?: boolean }) {
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'AUTH_ALLOW_LEGACY_DEVICELESS_TOKENS') {
          return options?.allowLegacy === false ? 'false' : 'true';
        }
        return fallback;
      }),
    } as unknown as ConfigService;

    const jwtService = {
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    const redis = {
      mget: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    const service = new WsAuthService(configService, jwtService, redis);
    return { service, jwtService, redis };
  }

  async function runMiddleware(
    middleware: (socket: Socket, next: (err?: Error) => void) => void,
    socket: Socket,
  ): Promise<Error | undefined> {
    return new Promise((resolve) => {
      middleware(socket, (err?: Error) => {
        resolve(err);
      });
    });
  }

  it('attaches namespace auth middleware only once per server instance', () => {
    const { service } = createService();
    const use = jest.fn();
    const server = { use } as unknown as Server;

    service.attachNamespaceAuth(server);
    service.attachNamespaceAuth(server);

    expect(use).toHaveBeenCalledTimes(1);
  });

  it('rejects socket when token is missing', async () => {
    const { service } = createService();
    let middleware: ((socket: Socket, next: (err?: Error) => void) => void) | undefined;
    const server = {
      use: jest.fn((handler: (socket: Socket, next: (err?: Error) => void) => void) => {
        middleware = handler;
      }),
    } as unknown as Server;

    service.attachNamespaceAuth(server);

    const err = await runMiddleware(
      middleware as (socket: Socket, next: (err?: Error) => void) => void,
      {
        handshake: { auth: {}, headers: {} },
        data: {},
        id: 'socket-1',
      } as unknown as Socket,
    );

    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as UnauthorizedException).message).toBe('Missing token');
  });

  it('authenticates valid token and sets socket data', async () => {
    const { service, jwtService, redis } = createService();
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      type: 'access',
      sub: 'user-1',
      jti: 'jti-1',
      iat: 1000,
      exp: 2000,
      deviceId: 'device-1',
    });
    (redis.mget as jest.Mock).mockResolvedValue([null, '0']);

    let middleware: ((socket: Socket, next: (err?: Error) => void) => void) | undefined;
    const server = {
      use: jest.fn((handler: (socket: Socket, next: (err?: Error) => void) => void) => {
        middleware = handler;
      }),
    } as unknown as Server;

    service.attachNamespaceAuth(server);

    const socket = {
      handshake: { auth: { token: 'token-1' }, headers: {} },
      data: {},
      id: 'socket-1',
    } as unknown as Socket;

    const err = await runMiddleware(
      middleware as (socket: Socket, next: (err?: Error) => void) => void,
      socket,
    );

    expect(err).toBeUndefined();
    expect((socket as any).data.userId).toBe('user-1');
    expect((socket as any).data.deviceId).toBe('device-1');
  });

  it('rejects revoked token from blacklist', async () => {
    const { service, jwtService, redis } = createService();
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      type: 'access',
      sub: 'user-1',
      jti: 'jti-1',
      iat: 1000,
      exp: 2000,
      deviceId: 'device-1',
    });
    (redis.mget as jest.Mock).mockResolvedValue(['1', null]);

    let middleware: ((socket: Socket, next: (err?: Error) => void) => void) | undefined;
    const server = {
      use: jest.fn((handler: (socket: Socket, next: (err?: Error) => void) => void) => {
        middleware = handler;
      }),
    } as unknown as Server;

    service.attachNamespaceAuth(server);

    const err = await runMiddleware(
      middleware as (socket: Socket, next: (err?: Error) => void) => void,
      {
        handshake: { auth: { token: 'token-1' }, headers: {} },
        data: {},
        id: 'socket-1',
      } as unknown as Socket,
    );

    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as UnauthorizedException).message).toBe('Token is revoked');
  });

  it('rejects token issued before logout-after timestamp', async () => {
    const { service, jwtService, redis } = createService();
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      type: 'access',
      sub: 'user-1',
      jti: 'jti-1',
      iat: 1000,
      exp: 2000,
    });
    (redis.mget as jest.Mock).mockResolvedValue([null, '1000']);

    let middleware: ((socket: Socket, next: (err?: Error) => void) => void) | undefined;
    const server = {
      use: jest.fn((handler: (socket: Socket, next: (err?: Error) => void) => void) => {
        middleware = handler;
      }),
    } as unknown as Server;

    service.attachNamespaceAuth(server);

    const err = await runMiddleware(
      middleware as (socket: Socket, next: (err?: Error) => void) => void,
      {
        handshake: { auth: { token: 'token-1' }, headers: {} },
        data: {},
        id: 'socket-1',
      } as unknown as Socket,
    );

    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as UnauthorizedException).message).toBe('Token is revoked');
  });

  it('rejects legacy token without device when legacy support disabled', async () => {
    const { service, jwtService, redis } = createService({ allowLegacy: false });
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      type: 'access',
      sub: 'user-1',
      jti: 'jti-1',
      iat: 1000,
      exp: 2000,
    });
    (redis.mget as jest.Mock).mockResolvedValue([null, '0']);

    let middleware: ((socket: Socket, next: (err?: Error) => void) => void) | undefined;
    const server = {
      use: jest.fn((handler: (socket: Socket, next: (err?: Error) => void) => void) => {
        middleware = handler;
      }),
    } as unknown as Server;

    service.attachNamespaceAuth(server);

    const err = await runMiddleware(
      middleware as (socket: Socket, next: (err?: Error) => void) => void,
      {
        handshake: { auth: { token: 'token-1' }, headers: {} },
        data: {},
        id: 'socket-1',
      } as unknown as Socket,
    );

    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as UnauthorizedException).message).toBe('Invalid token payload');
  });
});

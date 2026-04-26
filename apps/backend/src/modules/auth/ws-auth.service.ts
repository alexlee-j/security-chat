import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class WsAuthService {
  private readonly attachedServers = new WeakSet<object>();
  private readonly jwtSecret: string;
  private readonly allowLegacyDeviceLessTokens: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const secret = this.configService.get<string>('JWT_SECRET');
    if (isProduction && !secret) {
      throw new Error('JWT_SECRET environment variable is required in production');
    }

    this.jwtSecret = secret || 'dev_secret_change_me';
    this.allowLegacyDeviceLessTokens =
      this.configService.get<string>('AUTH_ALLOW_LEGACY_DEVICELESS_TOKENS', 'true') === 'true';
  }

  attachNamespaceAuth(server: Server): void {
    const serverRef = server as unknown as object;
    if (this.attachedServers.has(serverRef)) {
      return;
    }
    this.attachedServers.add(serverRef);

    server.use((socket, next) => {
      void this.authenticateSocket(socket, next);
    });
  }

  private async authenticateSocket(
    socket: Socket,
    next: (err?: Error) => void,
  ): Promise<void> {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        return next(new UnauthorizedException('Missing token'));
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.jwtSecret,
      });
      if (payload.type !== 'access') {
        return next(new UnauthorizedException('Invalid token type'));
      }
      if (!payload.deviceId && !this.allowLegacyDeviceLessTokens) {
        return next(new UnauthorizedException('Invalid token payload'));
      }

      const [blacklisted, logoutAfterRaw] = await this.redis
        .mget(
          `token:blacklist:${payload.jti}`,
          `token:logout-after:${payload.sub}`,
        )
        .catch(() => [null, null] as Array<string | null>);

      if (blacklisted) {
        return next(new UnauthorizedException('Token is revoked'));
      }

      const logoutAfter = Number(logoutAfterRaw ?? '0');
      if (Number.isFinite(logoutAfter) && logoutAfter > 0 && payload.iat <= logoutAfter) {
        return next(new UnauthorizedException('Token is revoked'));
      }

      socket.data.userId = payload.sub;
      socket.data.deviceId = payload.deviceId ?? socket.id;
      return next();
    } catch {
      return next(new UnauthorizedException('Unauthorized'));
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

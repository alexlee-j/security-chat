import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../infra/redis/redis.module';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly allowLegacyDeviceLessTokens: boolean;

  constructor(
    configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    const secret = configService.get<string>('JWT_SECRET');

    // 生产环境必须配置 JWT_SECRET
    if (isProduction && !secret) {
      throw new Error('JWT_SECRET environment variable is required in production');
    }

    const allowLegacyDeviceLessTokens =
      configService.get<string>('AUTH_ALLOW_LEGACY_DEVICELESS_TOKENS', 'true') === 'true';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'dev_secret_change_me',
    });

    this.allowLegacyDeviceLessTokens = allowLegacyDeviceLessTokens;
  }

  async validate(payload: JwtPayload): Promise<{
    userId: string;
    jti: string;
    tokenType: 'access' | 'refresh';
    deviceId?: string;
    iat: number;
    exp: number;
  }> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    if (!payload.deviceId && !this.allowLegacyDeviceLessTokens) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const [isBlacklisted, logoutAfterRaw] = await this.redis
      .mget(`token:blacklist:${payload.jti}`, `token:logout-after:${payload.sub}`)
      .catch(() => [null, null] as Array<string | null>);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token is revoked');
    }
    const logoutAfter = Number(logoutAfterRaw ?? '0');
    if (Number.isFinite(logoutAfter) && logoutAfter > 0 && payload.iat <= logoutAfter) {
      throw new UnauthorizedException('Token is revoked');
    }

    return {
      userId: payload.sub,
      jti: payload.jti,
      tokenType: payload.type,
      deviceId: payload.deviceId,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}

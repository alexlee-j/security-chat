import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../infra/redis/redis.module';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev_secret_change_me'),
    });
  }

  async validate(payload: JwtPayload): Promise<{
    userId: string;
    jti: string;
    tokenType: 'access' | 'refresh';
    exp: number;
  }> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const key = `token:blacklist:${payload.jti}`;
    const isBlacklisted = await this.redis.get(key).catch(() => null);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token is revoked');
    }

    return {
      userId: payload.sub,
      jti: payload.jti,
      tokenType: payload.type,
      exp: payload.exp,
    };
  }
}

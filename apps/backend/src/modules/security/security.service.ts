import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';

@Injectable()
export class SecurityService {
  private readonly loginFailWindowSeconds: number;
  private readonly loginMaxAttempts: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {
    this.loginFailWindowSeconds = Number(this.configService.get<string>('SEC_LOGIN_FAIL_WINDOW_SEC', '300'));
    this.loginMaxAttempts = Number(this.configService.get<string>('SEC_LOGIN_MAX_ATTEMPTS', '5'));
  }

  getStatus(): {
    module: string;
    status: string;
    loginMaxAttempts: number;
    loginFailWindowSeconds: number;
  } {
    return {
      module: 'security',
      status: 'ready',
      loginMaxAttempts: this.loginMaxAttempts,
      loginFailWindowSeconds: this.loginFailWindowSeconds,
    };
  }

  async assertLoginAllowed(identity: string, ip: string): Promise<void> {
    const key = this.loginFailKey(identity, ip);
    const current = Number(await this.redis.get(key).catch(() => '0'));
    if (current >= this.loginMaxAttempts) {
      throw new HttpException('Too many login attempts, please retry later', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async recordLoginFailure(identity: string, ip: string): Promise<void> {
    const key = this.loginFailKey(identity, ip);
    const count = await this.redis.incr(key).catch(() => 0);
    if (count === 1) {
      await this.redis.expire(key, this.loginFailWindowSeconds).catch(() => undefined);
    }
  }

  async clearLoginFailures(identity: string, ip: string): Promise<void> {
    const key = this.loginFailKey(identity, ip);
    await this.redis.del(key).catch(() => undefined);
  }

  private loginFailKey(identity: string, ip: string): string {
    return `sec:login:fail:${identity.toLowerCase()}:${ip}`;
  }
}

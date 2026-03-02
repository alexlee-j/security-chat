import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST', '127.0.0.1');
        const port = Number(configService.get<string>('REDIS_PORT', '6379'));
        const password = configService.get<string>('REDIS_PASSWORD', '');

        return new Redis({
          host,
          port,
          password: password || undefined,
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
          connectTimeout: 10000,
          retryStrategy: (times) => {
            // 指数退避策略，最大重试间隔为5秒
            return Math.min(times * 100, 5000);
          },
          keepAlive: 60000,
          family: 4,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}

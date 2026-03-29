import { randomUUID } from 'node:crypto';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const httpLogger = new Logger('HttpAccess');
  const enableHttpLog = process.env.LOG_HTTP !== '0';
  const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || localhostPattern.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  });
  app.use((req: { traceId?: string }, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    const traceId = randomUUID();
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);
    next();
  });
  app.use(
    (
      req: { traceId?: string; method?: string; originalUrl?: string; url?: string; ip?: string; headers?: Record<string, string | string[] | undefined> },
      res: { statusCode?: number; on: (event: 'finish', cb: () => void) => void },
      next: () => void,
    ) => {
      const start = Date.now();
      res.on('finish', () => {
        if (!enableHttpLog) {
          return;
        }
        const durationMs = Date.now() - start;
        const method = req.method ?? 'UNKNOWN';
        const path = req.originalUrl ?? req.url ?? '/';
        const status = res.statusCode ?? 0;
        const ip = req.ip ?? '-';
        const uaRaw = req.headers?.['user-agent'];
        const ua = Array.isArray(uaRaw) ? uaRaw[0] : uaRaw ?? '-';
        httpLogger.log(
          `${method} ${path} ${status} ${durationMs}ms traceId=${req.traceId ?? 'unknown'} ip=${ip} ua="${ua}"`,
        );
      });
      next();
    },
  );
  // 设置全局前缀，但排除 metrics 端点
  app.setGlobalPrefix('api/v1', {
    exclude: ['metrics'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();

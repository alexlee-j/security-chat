import { randomUUID } from 'node:crypto';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import * as cors from 'cors';

// 手动加载环境变量（必须在其他代码之前）
function loadEnv(): void {
  const logger = new Logger('LoadEnv');
  try {
    // 加载项目根目录的 .env 文件
    const envPath = path.resolve(process.cwd(), '../../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      let loadedCount = 0;
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...parts] = trimmed.split('=');
        if (key && parts.length > 0) {
          process.env[key.trim()] = parts.join('=').trim();
          loadedCount++;
        }
      });
      logger.log(`Loaded ${loadedCount} env vars from .env`);
    }

    // 也尝试加载 .env.development
    const devEnvPath = path.resolve(process.cwd(), '../../.env.development');
    if (fs.existsSync(devEnvPath)) {
      const content = fs.readFileSync(devEnvPath, 'utf-8');
      let loadedCount = 0;
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...parts] = trimmed.split('=');
        if (key && parts.length > 0) {
          process.env[key.trim()] = parts.join('=').trim();
          loadedCount++;
        }
      });
      logger.log(`Loaded ${loadedCount} env vars from .env.development`);
    }
  } catch (error) {
    logger.error('Failed to load env file:', error);
  }
}

loadEnv();

async function bootstrap(): Promise<void> {
  // 生产环境日志配置（需要在 loadEnv 之后）
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = process.env.LOG_LEVEL ?? (isProduction ? 'warn' : 'debug');
  
  const app = await NestFactory.create(AppModule, {
    logger: logLevel.split(',') as any[],
  });
  const httpLogger = new Logger('HttpAccess');
  const enableHttpLog = process.env.LOG_HTTP !== '0';
  
  /**
   * CORS 配置说明：
   * - Tauri 应用使用 tauri://localhost 协议
   * - WebSocket (socket.io) 不受 CORS 限制
   * - 开发环境允许所有本地地址
   * - 生产环境通过 CORS_ALLOWED_ORIGINS 环境变量配置
   */

  // Tauri 应用的固定源（所有平台通用）
  const tauriOrigins = [
    'tauri://localhost',
    'asset://localhost',
    'app://localhost',
    'http://tauri.localhost',
  ];

  // 生产环境允许的源（通过环境变量配置，逗号分隔）
  const prodOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(d => d.trim())
    : [];

  // 正则匹配模式（用于开发环境的局域网访问）
  const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  const privateNetworkPattern = /^https?:\/\/(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))\.\d+\.\d+(:\d+)?$/;

  // CORS 配置
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // 开发环境允许所有源（包括 localhost 和局域网 IP）
      if (process.env.NODE_ENV !== 'production') {
        // 允许没有 origin 的请求（如 Postman、curl）
        if (!origin) {
          callback(null, true);
          return;
        }
        // 开发环境允许 localhost 和局域网
        if (localhostPattern.test(origin) || privateNetworkPattern.test(origin)) {
          callback(null, true);
          return;
        }
        callback(null, true); // 开发环境允许所有
        return;
      }

      // 生产环境：严格检查
      // 允许没有 origin 的请求
      if (!origin) {
        callback(null, true);
        return;
      }
      // 允许 Tauri 应用
      if (tauriOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // 允许配置的域名
      if (prodOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS policy violation'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Trace ID 中间件
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

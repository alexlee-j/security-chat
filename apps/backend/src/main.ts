import { randomUUID } from 'node:crypto';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // 生产环境日志配置
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
   * - 只需要允许 Tauri 应用的固定源和 Web 前端域名
   */
  
  // Tauri 应用的固定源（所有平台通用）
  const tauriOrigins = [
    'tauri://localhost',      // Tauri 2.x
    'asset://localhost',      // Tauri 1.x (Android)
    'app://localhost',        // Tauri 1.x (其他平台)
    'http://tauri.localhost', // Tauri 2.x 新协议
  ];
  
  // 开发环境允许的源
  const devOrigins = [
    'http://localhost:4173',      // Vite 开发服务器
    'http://localhost',            // 本地访问
    'http://127.0.0.1:4173',
    'http://127.0.0.1',
  ];
  
  // 生产环境允许的源（Web 前端域名）
  const prodOrigins = [
    'https://app.security-chat.com',
    'https://www.security-chat.com',
    'https://www.silencelee.cn',  // 用户生产域名
    'https://silencelee.cn',       // 不带 www 的域名
  ];
  
  // 正则匹配模式（用于开发环境的局域网访问）
  const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  const privateNetworkPattern = /^https?:\/\/(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))\.\d+\.\d+(:\d+)?$/;
  
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // 开发环境：允许所有本地和私有网络地址
      if (process.env.NODE_ENV === 'development') {
        if (!origin || 
            localhostPattern.test(origin) || 
            privateNetworkPattern.test(origin) ||
            tauriOrigins.includes(origin) ||
            devOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
      }
      
      // 生产环境：只允许 Tauri 应用和配置的 Web 域名
      if (origin && (tauriOrigins.includes(origin) || prodOrigins.includes(origin))) {
        callback(null, true);
        return;
      }
      
      // 其他来源拒绝
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

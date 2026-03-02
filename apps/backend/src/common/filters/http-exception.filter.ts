import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

const SENSITIVE_KEYS = new Set([
  'password',
  'code',
  'accessToken',
  'refreshToken',
  'token',
  'authorization',
]);

function maskSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveData(item));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, innerValue] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = maskSensitiveData(innerValue);
      }
    }
    return result;
  }

  return value;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<{ traceId?: string; method: string; url: string; body?: any }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof raw === 'string'
        ? raw
        : typeof raw === 'object' && raw !== null && 'message' in raw
          ? (raw as { message: string | string[] }).message
          : exception instanceof Error
            ? exception.message
            : 'Internal server error';

    // 记录详细的错误日志
    this.logger.error(
      `[${request.traceId ?? 'unknown'}] ${request.method} ${request.url}`,
      {
        status,
        message,
        body: maskSensitiveData(request.body),
        stack: exception instanceof Error ? exception.stack : undefined,
      },
    );

    response.status(status).json({
      success: false,
      traceId: request.traceId ?? 'unknown',
      error: {
        code: status,
        message,
      },
    });
  }
}

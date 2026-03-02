import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

interface ApiSuccess<T> {
  success: boolean;
  traceId: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  private readonly logger = new Logger(ResponseInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    const request = context.switchToHttp().getRequest<{ traceId?: string; method: string; url: string }>();
    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        traceId: request.traceId ?? 'unknown',
        data,
        timestamp: new Date().toISOString(),
      })),
      tap(() => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // 记录请求处理时间
        this.logger.log(
          `[${request.traceId ?? 'unknown'}] ${request.method} ${request.url} - ${responseTime}ms`,
          { responseTime, traceId: request.traceId }
        );
      }),
    );
  }
}

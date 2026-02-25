import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ApiSuccess<T> {
  success: true;
  traceId: string;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    const request = context.switchToHttp().getRequest<{ traceId?: string }>();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        traceId: request.traceId ?? 'unknown',
        data,
      })),
    );
  }
}

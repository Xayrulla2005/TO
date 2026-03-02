import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';

@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const traceId = request.headers['x-trace-id'] || uuid();
    request.traceId = traceId;
    response.setHeader('X-Trace-Id', traceId);

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          console.log(`[${traceId}] ${request.method} ${request.url} ${response.statusCode} ${duration}ms`);
        },
        error: () => {
          const duration = Date.now() - startTime;
          console.error(`[${traceId}] ${request.method} ${request.url} ERROR ${duration}ms`);
        },
      }),
    );
  }
}
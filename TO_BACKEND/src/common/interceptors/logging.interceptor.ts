// ============================================================
// src/common/interceptors/logging.interceptor.ts
// ============================================================
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const traceId = request.traceId || 'no-trace-id';
    const user = request.user ? request.user.username : 'anonymous';

    const now = Date.now();

    // Log request
    this.logger.log(
      `[${traceId}] ${method} ${url} - User: ${user} - IP: ${ip}`,
    );

    // Log sensitive endpoints with extra detail (excluding password fields)
    if (method !== 'GET') {
      const sanitizedBody = this.sanitizeBody(body);
      this.logger.debug(
        `[${traceId}] Request Body: ${JSON.stringify(sanitizedBody)}`,
      );
    }

    return next.handle().pipe(
      tap((data) => {
        const response = context.switchToHttp().getResponse();
        const { statusCode } = response;
        const elapsed = Date.now() - now;

        this.logger.log(
          `[${traceId}] ${method} ${url} ${statusCode} - ${elapsed}ms`,
        );

        // Log mutations (non-GET requests) with response summary
        if (method !== 'GET' && statusCode < 400) {
          this.logger.log(
            `[${traceId}] SUCCESS: ${method} ${url} completed in ${elapsed}ms`,
          );
        }
      }),
      catchError((error) => {
        const elapsed = Date.now() - now;
        this.logger.error(
          `[${traceId}] ERROR: ${method} ${url} - ${error.message} - ${elapsed}ms`,
          error.stack,
        );
        return throwError(() => error);
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'token', 'secret'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}
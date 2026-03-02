import { CallHandler as CH2, ExecutionContext as EC2, Injectable as Inj3, NestInterceptor as NI2 } from '@nestjs/common';
import { Observable as Obs2 } from 'rxjs';
import { map } from 'rxjs/operators';

@Inj3()
export class SuccessResponseInterceptor implements NI2 {
  intercept(context: EC2, next: CH2): Obs2<unknown> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data: unknown) => {
        // Don't wrap if already wrapped or if it's a paginated response
        if (data && typeof data === 'object' && 'meta' in (data as Record<string, unknown>)) {
          return {
            status: response.statusCode || 200,
            message: 'success',
            ...data,
            timestamp: new Date().toISOString(),
          };
        }

        return {
          status: response.statusCode || 200,
          message: 'success',
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
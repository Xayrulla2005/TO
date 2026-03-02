import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiErrorResponse } from '../dto/api.error.dto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ traceId?: string; url?: string; method?: string }>();

    const traceId = request?.traceId || uuidv4();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal Server Error';

    let details: Record<string, string[]> | undefined;

    // Handle class-validator errors
    if (exception instanceof HttpException) {
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'object' && 'message' in exResponse && Array.isArray((exResponse as { message: unknown }).message)) {
        const messages = (exResponse as { message: string[] }).message;
        details = { validation: messages };
      }
    }

    const errorResponse: ApiErrorResponse = {
      status,
      message: Array.isArray(message) ? message[0] : message,
      error: exception instanceof HttpException ? exception.constructor.name : 'InternalServerError',
      details,
      timestamp: new Date().toISOString(),
      traceId,
    };

    // Log internal errors
    if (status >= 500) {
      console.error(`[${traceId}] ${request?.method} ${request?.url}`, exception);
    }

    response.status(status).json(errorResponse);
  }
}
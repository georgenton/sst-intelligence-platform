import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

type ApiError = { code?: string; message?: string; details?: unknown };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request & { id?: string }>();
    const status =
      error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = error instanceof HttpException ? error.getResponse() : undefined;
    const value: ApiError = typeof raw === 'object' && raw !== null ? raw : {};
    const rawMessage = value.message ?? (typeof raw === 'string' ? raw : undefined);
    response.status(status).json({
      code: value.code ?? (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
      message:
        status === 500
          ? 'No pudimos procesar la solicitud.'
          : (rawMessage ?? 'La solicitud no pudo completarse.'),
      details: value.details ?? {},
      traceId: request.id ?? 'unknown',
    });
  }
}

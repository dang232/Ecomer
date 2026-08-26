import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { CartDomainException } from '../domain/cart-domain.exception';

interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
  readonly code: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly retryable: boolean;
  readonly fields: Record<string, readonly string[]>;
  readonly errorCode: string;
}

function requestId(request: Request): string {
  const value = request.header('x-request-id');
  return value && value.length <= 128 ? value : randomUUID();
}

function problem(code: string, detail: string, status: number, request: Request, fields: Record<string, readonly string[]> = {}): ProblemDetails {
  const id = requestId(request);
  return {
    type: `https://api.vnshop.com/problems/${code.toLowerCase()}`,
    title: HttpStatus[status] ?? 'Request failed',
    status,
    detail,
    instance: request.originalUrl ?? request.url ?? '/',
    code,
    requestId: id,
    traceId: id,
    retryable: status === 425 || status === 429 || status >= 500,
    fields,
    errorCode: code,
  };
}

@Catch()
export class CartExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let detail = 'Internal server error';
    let fields: Record<string, readonly string[]> = {};

    if (exception instanceof CartDomainException) {
      status = this.resolveStatus(exception);
      code = exception.errorCode;
      detail = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = HttpStatus[status] ?? 'HTTP_ERROR';
      detail = status >= 500 ? 'Internal server error' : exception.message;
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'message' in body && Array.isArray(body.message)) {
        fields = { _global: body.message.filter((message): message is string => typeof message === 'string') };
      }
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS || status === HttpStatus.TOO_EARLY) response.setHeader('Retry-After', '1');
    response.status(status).type('application/problem+json').json(problem(code, detail, status, request, fields));
  }

  private resolveStatus(exception: CartDomainException): number {
    switch (exception.errorCode) {
      case 'CART_FULL':
      case 'CART_ITEM_LIMIT_EXCEEDED': return 422;
      case 'CART_ITEM_NOT_FOUND':
      case 'PRODUCT_NOT_FOUND':
      case 'VARIANT_NOT_FOUND': return 404;
      case 'INVALID_CART_OPERATION': return 400;
      case 'CURRENCY_MISMATCH': return 500;
      default: return 500;
    }
  }
}

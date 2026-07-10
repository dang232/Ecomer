import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { CartDomainException } from '../domain/cart-domain.exception';

/**
 * Standard VNShop error response shape.
 * { code, message, details, timestamp, traceId }
 */
interface ErrorResponse {
  code: string;
  message: string;
  details: string[];
  timestamp: string;
  traceId: string | null;
}

function buildError(
  code: string,
  message: string,
  details: string[] = [],
  traceId: string | null = null,
): ErrorResponse {
  return { code, message, details, timestamp: new Date().toISOString(), traceId };
}

/** Extract OTEL traceId from `traceparent` header injected by the OTEL SDK, if present. */
function resolveTraceId(request: { headers?: Record<string, string | string[] | undefined> }): string | null {
  const traceparent = request.headers?.['traceparent'];
  if (typeof traceparent !== 'string') return null;
  // traceparent format: 00-<traceId>-<spanId>-<flags>
  const parts = traceparent.split('-');
  return parts.length >= 2 ? (parts[1] ?? null) : null;
}

@Catch()
export class CartExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const traceId = resolveTraceId(request);

    if (
      exception instanceof Error &&
      (exception as NodeJS.ErrnoException).code === 'CART_VERSION_CONFLICT'
    ) {
      response
        .status(HttpStatus.CONFLICT)
        .json(buildError('CART_VERSION_CONFLICT', exception.message, [], traceId));
      return;
    }

    if (exception instanceof CartDomainException) {
      response
        .status(this.resolveStatus(exception))
        .json(buildError(exception.errorCode, exception.message, [], traceId));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const details: string[] =
        body && typeof body === 'object' && 'message' in body && Array.isArray((body as Record<string, unknown>).message)
          ? ((body as Record<string, unknown>).message as string[])
          : [];
      response
        .status(status)
        .json(
          buildError(
            HttpStatus[status] ?? 'HTTP_ERROR',
            exception.message,
            details,
            traceId,
          ),
        );
      return;
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(buildError('INTERNAL_SERVER_ERROR', 'Internal server error', [], traceId));
  }

  private resolveStatus(exception: CartDomainException): number {
    switch (exception.errorCode) {
      case 'CART_FULL': return 422;
      case 'CART_ITEM_LIMIT_EXCEEDED': return 422;
      case 'CART_ITEM_NOT_FOUND': return 404;
      case 'INVALID_CART_OPERATION': return 400;
      case 'CURRENCY_MISMATCH': return 500;
      case 'PRODUCT_NOT_FOUND': return 404;
      case 'VARIANT_NOT_FOUND': return 404;
      default: return 500;
    }
  }
}

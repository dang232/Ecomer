import { ArgumentsHost, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { CartExceptionFilter } from './cart.exception-filter';

describe('CartExceptionFilter problem details contract', () => {
  it('returns RFC 7807 fields and uses X-Request-ID as traceId', () => {
    const status = jest.fn<Response, [number]>().mockReturnThis();
    const type = jest.fn<Response, [string]>().mockReturnThis();
    const json = jest.fn<void, [Record<string, unknown>]>();
    const response = {
      status,
      type,
      setHeader: jest.fn(),
      json,
    } as unknown as Response;
    const request = {
      headers: { 'x-request-id': 'req-cart-1' },
      header: (name: string) =>
        name === 'x-request-id' ? 'req-cart-1' : undefined,
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    new CartExceptionFilter().catch(
      new HttpException({ message: ['quantity must be positive'] }, 422),
      host,
    );

    expect(status).toHaveBeenCalledWith(422);
    expect(type).toHaveBeenCalledWith('application/problem+json');
    const payload = json.mock.calls[0]?.[0];
    expect(payload.status).toBe(422);
    expect(payload.requestId).toBe('req-cart-1');
    expect(payload.traceId).toBe('req-cart-1');
    expect(payload.retryable).toBe(false);
    expect(payload.fields).toEqual({ _global: ['quantity must be positive'] });
  });
});

import { ArgumentsHost, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { CartExceptionFilter } from './cart.exception-filter';

describe('CartExceptionFilter problem details contract', () => {
  it('returns RFC 7807 fields and uses X-Request-ID as traceId', () => {
    const json = jest.fn();
    const response = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      json,
    } as unknown as Response;
    const request = { headers: { 'x-request-id': 'req-cart-1' }, header: (name: string) => name === 'x-request-id' ? 'req-cart-1' : undefined };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    new CartExceptionFilter().catch(new HttpException({ message: ['quantity must be positive'] }, 422), host);

    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      type: expect.any(String),
      title: expect.any(String),
      status: 422,
      detail: expect.any(String),
      instance: expect.any(String),
      code: expect.any(String),
      requestId: 'req-cart-1',
      traceId: 'req-cart-1',
      retryable: false,
      fields: { _global: ['quantity must be positive'] },
    }));
  });
});

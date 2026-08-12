import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { GatewayAuthGuard } from './gateway-auth.guard.js';

describe('GatewayAuthGuard internal configuration access', () => {
  const originalToken = process.env.CONFIG_SERVICE_INTERNAL_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.CONFIG_SERVICE_INTERNAL_TOKEN;
    else process.env.CONFIG_SERVICE_INTERNAL_TOKEN = originalToken;
  });

  it('accepts the configured service token', () => {
    process.env.CONFIG_SERVICE_INTERNAL_TOKEN = 'internal-secret';
    const reflector = new Reflector();
    const guard = new GatewayAuthGuard(reflector);
    const handler = () => undefined;
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-config-service-token': 'internal-secret' } }),
      }),
    } as never;

    expect(guard.canActivate(context)).toBe(true);
  });

  it.each([
    ['when the token is missing', undefined, undefined],
    ['when the token is mismatched', 'wrong-secret', 'internal-secret'],
  ])('%s', (_caseName, presentedToken, configuredToken) => {
    if (configuredToken === undefined) delete process.env.CONFIG_SERVICE_INTERNAL_TOKEN;
    else process.env.CONFIG_SERVICE_INTERNAL_TOKEN = configuredToken;
    const reflector = new Reflector();
    const guard = new GatewayAuthGuard(reflector);
    const handler = () => undefined;
    const headers: Record<string, string> = {};
    if (presentedToken !== undefined) headers['x-config-service-token'] = presentedToken;
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});

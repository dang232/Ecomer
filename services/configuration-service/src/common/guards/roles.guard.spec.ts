import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard internal configuration access', () => {
  const originalToken = process.env.CONFIG_SERVICE_INTERNAL_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.CONFIG_SERVICE_INTERNAL_TOKEN;
    else process.env.CONFIG_SERVICE_INTERNAL_TOKEN = originalToken;
  });

  function context(headers: Record<string, string>) {
    const reflector = new Reflector();
    const handler = () => undefined;
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === ROLES_KEY ? ['ADMIN'] : undefined,
    );
    return {
      reflector,
      executionContext: {
        getHandler: () => handler,
        getClass: () => class TestController {},
        switchToHttp: () => ({ getRequest: () => ({ headers }) }),
      } as never,
    };
  }

  it('accepts the configured service token without trusting caller-supplied roles', () => {
    process.env.CONFIG_SERVICE_INTERNAL_TOKEN = 'internal-secret';
    const { reflector, executionContext } = context({
      'x-config-service-token': 'internal-secret',
      'x-user-roles': 'ADMIN',
    });

    expect(new RolesGuard(reflector).canActivate(executionContext)).toBe(true);
  });

  it.each([
    ['when the token is absent', {}, 'internal-secret'],
    ['when the token is mismatched', { 'x-config-service-token': 'wrong-secret', 'x-user-roles': 'ADMIN' }, 'internal-secret'],
    ['when only caller-supplied roles are present', { 'x-user-roles': 'ADMIN' }, undefined],
  ])('%s', (_caseName, headers, configuredToken) => {
    if (configuredToken === undefined) delete process.env.CONFIG_SERVICE_INTERNAL_TOKEN;
    else process.env.CONFIG_SERVICE_INTERNAL_TOKEN = configuredToken;
    const { reflector, executionContext } = context(headers);

    expect(() => new RolesGuard(reflector).canActivate(executionContext)).toThrow(ForbiddenException);
  });
});

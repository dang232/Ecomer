import { RolesGuard } from './roles.guard.js';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function mockContext(user: unknown): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  it('allows access when no roles required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext({}))).toBe(true);
  });

  it('allows a public route even when its controller requires admin', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(['admin']);
    expect(guard.canActivate(mockContext(undefined))).toBe(true);
  });

  it('denies access when user has no matching role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const user = { sub: '1', realm_access: { roles: ['buyer'] } };
    expect(guard.canActivate(mockContext(user))).toBe(false);
  });

  it('allows access when user has admin role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const user = { sub: '1', realm_access: { roles: ['admin', 'buyer'] } };
    expect(guard.canActivate(mockContext(user))).toBe(true);
  });

  it('denies access when no user on request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    expect(guard.canActivate(mockContext(undefined))).toBe(false);
  });
});

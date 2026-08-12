import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class GatewayAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const internalToken = process.env.CONFIG_SERVICE_INTERNAL_TOKEN;
    const presentedToken = request.headers['x-config-service-token'];
    if (!internalToken || presentedToken !== internalToken) {
      throw new UnauthorizedException('Invalid configuration service token');
    }
    return true;
  }
}

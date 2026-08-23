import type { Request } from 'express';
import type { JwtUser } from './jwt.strategy';

export type AuthenticatedRequest = Request & {
  readonly user: JwtUser;
};

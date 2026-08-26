import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export interface JwtUser {
  sub: string;
  [claim: string]: unknown;
}

type JwtStrategyOptions = Extract<
  StrategyOptions,
  { passReqToCallback?: false | undefined }
>;

export function createJwtStrategyOptions(): JwtStrategyOptions {
  const issuerUri =
    process.env.KEYCLOAK_ISSUER_URI ?? 'http://localhost:9090/realms/vnshop';
  const jwksUri =
    process.env.KEYCLOAK_JWK_SET_URI ??
    'http://keycloak:8080/realms/vnshop/protocol/openid-connect/certs';
  const audience = process.env.KEYCLOAK_JWT_AUDIENCE ?? 'vnshop-api';

  return {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    issuer: issuerUri,
    audience,
    algorithms: ['RS256'],
    secretOrKeyProvider: passportJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      jwksUri,
    }),
  };
}

/**
 * Validates Bearer JWTs minted by the Keycloak realm shared with the rest of
 * the platform. The gateway delegates token issuance to Keycloak via PKCE and
 * forwards the Authorization header downstream — notification-service must
 * validate that header itself instead of trusting `x-user-id`, otherwise the
 * service is vulnerable to IDOR when reached via a port-forward, sidecar, or
 * mis-routed request.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private static readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    const jwksUri =
      process.env.KEYCLOAK_JWK_SET_URI ??
      'http://keycloak:8080/realms/vnshop/protocol/openid-connect/certs';
    const options = createJwtStrategyOptions();
    super(options);
    JwtStrategy.logger.log(
      `JWT strategy initialised (issuer=${options.issuer}, jwks=${jwksUri})`,
    );
  }

  validate(payload: JwtUser): JwtUser {
    return payload;
  }
}

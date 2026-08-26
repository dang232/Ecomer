import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export interface JwtPayload {
  sub: string;
  realm_access?: { roles?: string[] };
  [claim: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private static readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    const issuerUri =
      process.env.KEYCLOAK_ISSUER_URI ?? 'http://localhost:9090/realms/vnshop';
    const jwksUri =
      process.env.KEYCLOAK_JWK_SET_URI ??
      'http://keycloak:8080/realms/vnshop/protocol/openid-connect/certs';
    const audience = process.env.KEYCLOAK_JWT_AUDIENCE ?? 'vnshop-api';

    const options: StrategyOptions = {
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

    super(options);
    JwtStrategy.logger.log(
      `JWT strategy initialised (issuer=${issuerUri}, jwks=${jwksUri})`,
    );
  }

  validate(payload: JwtPayload): JwtPayload {
    if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
      throw new UnauthorizedException('Invalid token subject');
    }
    return payload;
  }
}

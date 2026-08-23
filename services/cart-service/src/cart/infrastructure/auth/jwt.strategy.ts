import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export interface JwtUser {
  readonly sub: string;
  readonly [claim: string]: unknown;
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

    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer: issuerUri,
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

  validate(payload: JwtUser): JwtUser {
    return payload;
  }
}

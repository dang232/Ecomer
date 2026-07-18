import { Injectable, Logger } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";

/**
 * Custom error thrown when the JWT is expired, allowing the gateway to
 * distinguish expired tokens from other validation failures.
 */
export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenExpiredError";
  }
}

/** Rate-limit interval for repeated JWT rejection logs from the same client IP. */
const LOG_THROTTLE_MS = 60_000;

/**
 * Validates a JWT for the WebSocket handshake. Lives outside passport-jwt
 * because `ws` upgrades aren't Express requests. The SPA offers the Bearer
 * token through a WebSocket subprotocol because browsers can't set custom
 * headers on WebSocket constructors; the gateway keeps a query-parameter
 * fallback for older clients while they roll forward.
 */
@Injectable()
export class WsJwtVerifier {
  private static readonly logger = new Logger(WsJwtVerifier.name);
  private readonly jwks: JwksClient;
  private readonly issuer: string;

  /** Tracks last log timestamp per client IP to throttle repeated warnings. */
  private readonly logThrottleMap = new Map<string, number>();

  constructor() {
    this.issuer =
      process.env.KEYCLOAK_ISSUER_URI ?? "http://localhost:9090/realms/vnshop";
    const jwksUri =
      process.env.KEYCLOAK_JWK_SET_URI ??
      "http://keycloak:8080/realms/vnshop/protocol/openid-connect/certs";
    this.jwks = new JwksClient({
      jwksUri,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  async verify(token: string): Promise<{ sub: string } & jwt.JwtPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          if (!header.kid) {
            callback(new Error("Missing kid"));
            return;
          }
          this.jwks
            .getSigningKey(header.kid)
            .then((key) => callback(null, key.getPublicKey()))
            .catch((err: unknown) =>
              callback(err instanceof Error ? err : new Error("JWKS failure")),
            );
        },
        { algorithms: ["RS256"], issuer: this.issuer },
        (err, decoded) => {
          if (err || !decoded || typeof decoded === "string") {
            const message = err?.message ?? "malformed payload";
            if (
              err?.name === "TokenExpiredError" ||
              message.includes("jwt expired")
            ) {
              reject(new TokenExpiredError(message));
            } else {
              reject(err ?? new Error("Malformed token"));
            }
            return;
          }
          if (typeof decoded.sub !== "string") {
            reject(new Error("Token missing sub claim"));
            return;
          }
          resolve(decoded as { sub: string } & jwt.JwtPayload);
        },
      );
    });
  }

  /**
   * Log a JWT rejection warning, throttled to once per client IP per minute.
   * Returns true if the message was actually logged.
   */
  logRejection(clientIp: string, reason: string): boolean {
    const now = Date.now();
    const lastLogged = this.logThrottleMap.get(clientIp);

    if (lastLogged && now - lastLogged < LOG_THROTTLE_MS) {
      return false;
    }

    this.logThrottleMap.set(clientIp, now);
    WsJwtVerifier.logger.warn(
      `WebSocket JWT rejected [${clientIp}]: ${reason}`,
    );

    // Periodic cleanup: evict stale entries when map grows large
    if (this.logThrottleMap.size > 1000) {
      for (const [ip, ts] of this.logThrottleMap) {
        if (now - ts > LOG_THROTTLE_MS) this.logThrottleMap.delete(ip);
      }
    }

    return true;
  }
}

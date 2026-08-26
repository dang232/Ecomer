import { registerAs } from "@nestjs/config";

export const appConfig = registerAs("app", () => ({
  port: parseInt(process.env.PORT ?? "8096", 10),
  gatewayUrl: process.env.GATEWAY_URL ?? "http://localhost:8080",
  gatewayActuatorUrl:
    process.env.GATEWAY_ACTUATOR_URL ??
    "http://localhost:8080/actuator/gateway/routes",
  /** 'auto' (try gateway, fallback to static) | 'static' (skip gateway entirely) */
  discoveryMode: process.env.DISCOVERY_MODE ?? "static",
  discoveryIntervalMs: parseInt(
    process.env.DISCOVERY_INTERVAL_MS ?? "300000",
    10,
  ),
  healthPollIntervalMs: parseInt(
    process.env.HEALTH_POLL_INTERVAL_MS ?? "10000",
    10,
  ),
  openapiEnabled: process.env.OPENAPI_ENABLED ?? "true",
  openapiDocumentVersion: process.env.OPENAPI_DOCUMENT_VERSION ?? "1.0.0",
  openapiGatewayServerUrl:
    process.env.OPENAPI_GATEWAY_SERVER_URL ?? "http://localhost:8080",
  openapiRefreshIntervalMs: parseInt(
    process.env.OPENAPI_REFRESH_INTERVAL_MS ?? "300000",
    10,
  ),
  openapiFetchTimeoutMs: parseInt(
    process.env.OPENAPI_FETCH_TIMEOUT_MS ?? "3000",
    10,
  ),
  keycloak: {
    issuerUri:
      process.env.KEYCLOAK_ISSUER_URI ?? "http://localhost:9090/realms/vnshop",
    audience: process.env.KEYCLOAK_JWT_AUDIENCE ?? "vnshop-api",
    jwkSetUri:
      process.env.KEYCLOAK_JWK_SET_URI ??
      "http://keycloak:8080/realms/vnshop/protocol/openid-connect/certs",
    adminRole: process.env.KEYCLOAK_ADMIN_ROLE ?? "ADMIN",
  },
}));

# JWT Audience and Issuer Matrix

## Resource-server contract

All Spring resource servers and Node JWT verifiers accept only:

- Issuer: `KEYCLOAK_ISSUER_URI`, defaulting to the realm issuer configured by the deployment.
- JWKS: `KEYCLOAK_JWK_SET_URI`, retained as the back-channel key endpoint for rotation.
- Algorithm: `RS256`.
- Audience: `KEYCLOAK_JWT_AUDIENCE`, default `vnshop-api`.

`iss` identifies the Keycloak realm that minted a token. `aud` identifies the API resource that the token was minted to call. A valid signature or issuer alone is not sufficient.

## Service matrix

| Consumer | Surface | Issuer | JWKS | Required audience | User/service distinction |
| --- | --- | --- | --- | --- | --- |
| `api-gateway` | HTTP edge | `KEYCLOAK_ISSUER_URI` | `KEYCLOAK_JWK_SET_URI` | `vnshop-api` | Browser user tokens enter through the gateway; gateway forwards the bearer unchanged. |
| Java services | Direct HTTP resource server | `KEYCLOAK_ISSUER_URI` | `KEYCLOAK_JWK_SET_URI` | `vnshop-api` | Audience validation is mandatory; service-only methods additionally use service identity where configured. |
| `cart-service` | Passport HTTP | `KEYCLOAK_ISSUER_URI` | `KEYCLOAK_JWK_SET_URI` | `vnshop-api` | User bearer only. No outbound fallback token. |
| `notification-service` | Passport HTTP and Socket.IO | `KEYCLOAK_ISSUER_URI` | `KEYCLOAK_JWK_SET_URI` | `vnshop-api` | Socket identity is the non-empty `sub`; no caller-supplied user headers are trusted. |
| `messaging-service` | Passport HTTP and raw WebSocket | `KEYCLOAK_ISSUER_URI` | `KEYCLOAK_JWK_SET_URI` | `vnshop-api` | WebSocket binds to verified `sub`; legacy query-token extraction remains compatibility-only and still requires full JWT validation. |
| `monitoring-service-v2` | Passport HTTP and admin Socket.IO | `KEYCLOAK_ISSUER_URI` | `KEYCLOAK_JWK_SET_URI` | `vnshop-api` | Socket token must pass issuer/audience/signature checks and carry `ADMIN`. |

## Internal service credentials

Client-credentials/service tokens are not interchangeable with browser user tokens. The configured `vnshop-api` audience is necessary but not sufficient for service-only operations; those operations must also require the configured service client identity (`azp`/service ID) or the dedicated gRPC service metadata contract.

- Payment gRPC uses `x-vnshop-service-id` plus `x-vnshop-service-token` and constant-time comparison.
- Configuration-service uses `x-config-service-token`; it is required when the Java startup client is enabled and is never synthesized from a user bearer.
- User-service internal methods use `azp`/`client_id` allow-listing for the configured service client.
- No outbound caller-token fallback is permitted: a missing user token must remain missing, and a missing service secret must fail closed.

## Rotation and deployment rules

- Keep issuer and JWKS values separately configurable because the public issuer may be gateway-reachable while JWKS is Docker-network-only.
- Rotate JWKS signing keys through Keycloak; verifiers use the configured JWKS client and retain cache/rate limiting.
- Rotate service secrets independently from user-token signing keys.
- Do not set a predictable default for any service secret in staging or production.
- A token with the wrong issuer, wrong audience, expired claims, unknown signing key, missing subject, or wrong service identity is rejected.

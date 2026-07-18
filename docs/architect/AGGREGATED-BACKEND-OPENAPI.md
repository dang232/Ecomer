# Aggregated Backend OpenAPI

The monitoring service aggregates OpenAPI documents from HTTP services routed by
the API gateway. Operators access the result through the gateway only:

```text
GET /monitoring/openapi.json
GET /monitoring/docs
```

Both paths require an administrator JWT. The normal Docker Compose deployment
does not publish the monitoring service port; use gateway port `8080` from the
private operator network.

## Refresh Behavior

The service first discovers gateway routes, then probes these internal schema
paths in order:

```text
/v3/api-docs
/api-docs
/api-docs-json
/api-json
```

Healthy service documents are cached in memory. A temporary service failure
marks its cached document `stale` in `x-vnshop-service-status` and keeps the
last known-good paths available. The endpoint returns `503` only before any
valid aggregate has been built.

## Aggregation Rules

- The public server is the gateway URL from `OPENAPI_GATEWAY_SERVER_URL`.
- Operation IDs and component names are prefixed with the service ID.
- Local component references are rewritten to the namespaced component.
- Operations receive a `<service-id>` tag and `x-vnshop-service`.
- Deprecated service operations receive `deprecated: true` and
  `x-vnshop-deprecated-since`.
- Unmatched gateway paths and duplicate operations reject a refresh; the prior
  valid document remains active.
- gRPC and Kafka contracts are documented outside this OpenAPI document.

Source-service documentation is disabled by default and enabled for the
internal Compose deployment with `SWAGGER_ENABLED=true`. The aggregator uses
`OPENAPI_ENABLED`, `OPENAPI_REFRESH_INTERVAL_MS`, and
`OPENAPI_FETCH_TIMEOUT_MS`; the published server URL is configured with
`OPENAPI_GATEWAY_SERVER_URL`.

Use `node scripts/validate-openapi.mjs <file-or-url>` in CI to validate the
document, or pipe JSON through `-` for local checks.

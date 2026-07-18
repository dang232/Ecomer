# Shopee HAR Investigation and VNShop Production Hardening

Status: `implemented` for the investigation and the first hardening slice; remaining work is tracked below.

## Safety

The source HAR is stored outside the repository at `C:\Users\dangq\Downloads\shopee.vn.har`.
It must not be committed, uploaded, or copied into this repository. This document contains
only aggregate statistics and redacted endpoint names. It intentionally omits cookies,
tokens, request values, account data, and response payload values.

If the HAR was shared outside the trusted environment, revoke captured browser sessions and
rotate any credentials that may have been present in the capture.

## Capture Findings

The capture contains 1,017 requests, including 117 Shopee web/API requests. The important
business calls are split by responsibility rather than delivered as one unbounded page
response:

| Capability | Observed request family | VNShop counterpart |
| --- | --- | --- |
| Platform bootstrap | `/api/v4/platform/get_ft_v2` | Gateway/configuration and frontend bootstrap |
| Experiments | `/api/v4/abtest/traffic/get_web_experiments` | Feature flags and future experiment service |
| Categories and banners | `/api/v4/pages/*`, `/api/v4/banner/*` | Product categories and storefront sections |
| Search | `/api/v4/search/search_items` | `search-service` |
| Search filters | `/api/v4/search/search_filter_config` | Search facets and filter configuration |
| Suggestions | `/api/v4/search/search_suggestion` | Search suggestions |
| Discovery | `/api/v4/homepage/get_daily_discover` | Product listing and future discovery feed |
| Flash sale | `/api/v4/flash_sale/flash_sale_get_items` | `inventory-service` flash-sale APIs |
| Recommendations | `/api/v4/recommend/recommend` | `recommendations-service` |
| Cart and notifications | `/api/v4/cart/*`, `/api/v4/notification/*` | Cart and notification services |

The search response contained item cards plus request/session/tracking/performance metadata.
The capture's search and daily-discovery calls were the slowest important reads at roughly
1.4 and 1.7 seconds respectively. Static module and image assets used CDN cache validators;
business API responses were generally not browser-cached.

## VNShop Decisions

### Compatibility

Existing endpoints remain unchanged. New cursor reads are additive:

```text
GET /search/v2
GET /products/v2
```

Cursor reads initially support only `newest`, `price-low`, and `price-high`. Legacy `rating`
and `popular` behavior remains unchanged until deterministic ranking fields exist in both
Elasticsearch and JPA.

### API Metadata

The server may add optional metadata without changing legacy data shapes:

```json
{
  "requestId": "...",
  "cacheStatus": "hit|miss|stale|bypass",
  "stale": false,
  "nextCursor": null,
  "hasMore": false
}
```

The frontend's legacy request helper continues to return only `data`. Cache-aware v2 calls
return `{ data, meta, status, headers }` so `304` responses can reuse an in-memory body.

### Cache and Redis Namespaces

Redis keys must use distinct namespaces:

```text
vnshop:cache:v2:*
vnshop:idempotency:v1:*
vnshop:ratelimit:v1:*
vnshop:flash-sale:v1:*
```

Public read cache failure falls back to the origin/read model. Mutation rate-limit failure
is fail-closed; low-risk public read limiting may fail open with an alert.

### Flash-Sale Authority

Reservation admission is one atomic port operation. Redis is the hot-path reservation
authority; durable persistence is completed through an outbox/reconciliation path. A failed
durable write is retried, and an unrecoverable reservation is compensated by releasing the
hot-path reservation and raising an alert. Idempotency retention is 20 minutes for the
15-minute reservation TTL plus a five-minute replay grace period.

## Implementation Status

| Item | Status | Evidence or follow-up |
| --- | --- | --- |
| HAR investigation and redaction rules | implemented | This document |
| API metadata and request IDs | implemented | Gateway correlation filter, v2 response metadata, and frontend metadata-result tests |
| ETag and `304` support | implemented | Public v2 GET validators, bounded frontend ETag cache, and empty-304 tests |
| `/search/v2` and `/products/v2` | implemented | Signed cursor/keyset reads, ES/JPA adapters, and gateway forwarding tests |
| Server cache namespaces and stale fallback | partial | Product cache, rate-limit, flash-sale, and idempotency namespaces are present; read-cache coalescing, TTL jitter, stale metrics, and live Redis fallback tests remain |
| Dedicated flash-sale rate limits | implemented | Gateway route tests and fail-closed mutation policy; k6 load evidence remains |
| Recommendation rate limits | implemented | Anonymous/authenticated gateway limiters and route coverage |
| Atomic flash-sale idempotency | implemented | Redis Lua reserve/release, 20-minute retention, durable outbox reconciliation, and focused replay/concurrency tests |
| Legacy contract compatibility | implemented | Existing service suites remain green where contract fixtures are available |
| Analytics event pipeline | deferred | No analytics owner/service was introduced in this release; implement after read-path observability is baselined |
| Personalized recommendations and ML ranking | deferred | Requires data governance and ranking fields |
| New storefront BFF | deferred | Revisit only if measured page composition exceeds budget |
| k6 load scenarios and provisional gates | planned | Add sustained and ramp-to-saturation tests for homepage, search, detail, recommendations, stock, and reserve |
| Secret scan and CI enforcement | planned | Add a CI assertion that the raw HAR path and payload are absent from tracked files |
| Pact provider verification | blocked | No generated consumer pact is present; unblock when the consumer contract pipeline publishes fixtures into `pacts/` |

## Verification Evidence (2026-07-18)

Passing local evidence:

| Area | Result |
| --- | --- |
| Search service full Maven suite | 28 tests passed |
| Product service full Maven suite | 170 tests passed, 2 skipped |
| API gateway full Maven suite | 24 tests passed |
| Inventory flash-sale focused suite | 10 tests passed |
| Frontend API/interceptor focused suites | 39 tests passed |
| Frontend TypeScript check | passed |

Not yet run in this workspace: the complete frontend suite, live Redis/Elasticsearch/PostgreSQL
integration tests, Pact verification with generated consumer pacts, k6 load tests, and a CI
secret-scanning job. The inventory unit/application suite passes; the Pact provider test remains
unavailable while `pacts/` contains only `.gitkeep`.

Production must provide stable `VNSHOP_SEARCH_CURSOR_SECRET` and
`VNSHOP_PRODUCT_CURSOR_SECRET` values. The local fallback values are for development and tests
only; they must not be used to deploy multiple production instances.

## Rollout Evidence To Record

Record p50/p95/p99 latency, 4xx/5xx/429 rates, cache hit/miss/stale rates, Elasticsearch
fallbacks, cursor correctness, and flash-sale oversell results after each implementation
slice. Provisional gates are catalog p95 under 500 ms, search p95 under 800 ms, reservation
p95 under 300 ms, public-read 5xx below 0.5%, and zero oversell in concurrency tests.

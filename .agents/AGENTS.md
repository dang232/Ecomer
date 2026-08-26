<!-- Generated: 2026-07-10 | Updated: 2026-08-18 -->

# VNShop E-Commerce Platform

## Purpose
Polyglot microservices marketplace (19 services, Spring Boot + NestJS + Python), React SPA, and Flutter mobile app for the Vietnamese market. Demonstrates DDD, CQRS, hexagonal architecture, event-driven sagas, and outbox patterns.

## Key Files
| File | Description |
|------|-------------|
| `README.md` | Primary project documentation — start here |
| `AGENTS.md` | (this file) AI-readable project overview |
| `HANDOFF.md` | Onboarding pickup doc for new contributors |
| `docs/SESSION-HANDOVER-2026-08-26-DEEP-FIX.md` | Current PR #320 scope, evidence, approval, and blockers |
| `docker-compose.yml` | Full stack orchestration (~60KB, all services + infra) |
| `.env` | Local environment config (secrets — never commit) |
| `.env.example` | Environment template (safe to commit) |

## Subdirectories
| Directory | Purpose | AGENTS |
|---------|---------|--------|
| `fe/` | React 18 + Vite SPA, Tailwind v4, TanStack Query, Playwright E2E | `.agents/fe/AGENTS.md` |
| `vnshop_mobile/` | Flutter 3.44 mobile app, BLoC, VietQR/MoMo, OneSignal | `.agents/vnshop_mobile/AGENTS.md` |
| `services/` | 19 microservices (Spring Boot, NestJS, Python) | `services/AGENTS.md` |
| `infra/` | Docker, Kafka, Prometheus, Grafana, certs, scripts | `.agents/infra/AGENTS.md` |
| `proto/` | gRPC protocol buffers (Buf-managed) | `.agents/proto/AGENTS.md` |
| `docs/` | Session handovers, audits, roadmaps, payment plans | — |
| `.sisyphus/` | Architecture and status canonicals | — |
| `.github/workflows/` | CI pipelines (Java test, FE, Flutter, lint) | — |

## Architecture Overview
- **Gateway**: Spring Cloud Gateway `:8080` → routes all services
- **Auth**: Keycloak 26.6 internal-only, native httpOnly-cookie auth through the gateway
- **Java services**: Java 25 LTS, Spring Boot 4.1.0, Maven, virtual threads
- **Node services**: NestJS 11, TypeScript, Redis
- **Messaging**: Kafka 8.2.0, SASL_PLAINTEXT, per-service ACLs
- **Data**: PostgreSQL 17 (per-service), Redis 8, Elasticsearch 9, MinIO
- **Payments**: COD, VietQR, SePay (live); Stripe, PayPal (sandbox); MoMo, VNPay (disabled by default)
- **Shipping**: GHN/GHTK adapters and live checkout protobuf contract are merged; `CARRIER_MODE=stub` remains a local default and production credentials/evidence are still required

## Current Status

- PR #320 is the current deep-fix wave at `3e33684` and records 32 completed todos.
- Trusted parcel variants now carry dimensions and declared value through product, cart, checkout, order, and shipping contracts; browser checkout must never invent dimensions.
- Durable saga/outbox delivery, principal-scoped idempotency, HMAC/JWT and mTLS boundaries, canonical Kafka/DLT contracts, RFC 7807 errors, `/api/v1` compatibility, cache hardening, HA/observability, FE/mobile parity, i18n, a11y, and immutable responsive media are documented in the handover and evidence logs.
- Final Wave is **APPROVE** for repository-owned scope only. Production Kubernetes remains blocked by external GHCR fixtures, SealedSecret values, real origins, provider credentials, broker/browser access, and HA/security approvals.
- The next feature backlog is the unchecked August admin cursor-pagination plan after checkout and release verification.

## For AI Agents

### Working In This Repo
- **NEVER commit secrets** — `.env` is excluded via `.gitignore`
- **NEVER expose internal ports** (8081-8098) — route through gateway `:8080`
- **DO NOT** use synchronous Kafka producers in user-facing hot paths
- **MUST** use tmpfs for video transcoding staging directories
- **KAFKA_VIDEO_TRANSPARECTOR_PASSWORD** and **KAFKA_VIDEO_MODERATOR_PASSWORD** have NO defaults — CI fails without them
- Compose production-like paths fail closed when required passwords are absent; use the explicit development overlay for local defaults only.
- MoMo and VNPay remain disabled. Do not add retroactive parcel/order backfills or claim live provider behavior without external evidence.
- All Java services use **Java 25** (check `pom.xml` for version)
- All NestJS services use **NestJS 11**

### Service Port Map
```
8080 api-gateway    8081 user-service   8082 product-service  8083 inventory-service
8084 cart-service   8086 search-service 8087 notification-svc 8088 coupon-service (legacy)
8090 seller-finance  8091 order-service  8092 payment-service 8093 shipping-service
8094 recommendations 8095 messaging-svc  8096 monitoring-svc-v2 8097 configuration-service
8098 invoice-service
```

### Testing
```bash
# API gate (fresh counts belong in the current handover and evidence logs)
node infra/scripts/e2e-day.mjs       # 65/65 endpoints
# FE gate
cd fe && npx playwright test         # 108/108 scenarios
# Per-service
cd services/<svc> && ./mvnw test    # Java
cd services/<svc> && npm test       # NestJS
```

### Quick Start
```bash
docker compose --profile apps up -d
bash infra/scripts/setup-keycloak-admin-client.sh
bash infra/scripts/init-kafka-topics.sh
node infra/scripts/seed-demo.mjs
```

### Local Access Points
| URL | Service |
|-----|---------|
| `http://localhost:3000` | React SPA (docker) |
| `http://localhost:5173` | React SPA (Vite dev) |
| `http://localhost:8080` | API Gateway |
| Docker network only | Keycloak identity provider; admin console is not host-exposed |
| `http://localhost:9000` | MinIO console |
| `http://localhost:9093` | Alertmanager |
| `http://localhost:9200` | Elasticsearch |
| `http://localhost:16686` | Jaeger tracing |

## Dependencies

### External
- Java 25 LTS — runtime for Spring Boot services
- Node.js 24 LTS — runtime for NestJS services
- Docker + Docker Compose — container orchestration
- Keycloak 26.6 — identity provider
- Kafka 8.2.0 (Confluent) — event streaming
- PostgreSQL 17.9 — per-service databases
- Redis 8.6 — caching and cart storage
- Elasticsearch 9.4.0 — search index
- MinIO — S3-compatible object storage
- FFmpeg — video transcoding
- Flutter 3.44 — mobile app SDK

## Manual Notes
<!-- MANUAL: -->

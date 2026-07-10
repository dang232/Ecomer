# VNShop E-Commerce Platform

> **⚠️ This file is stale (2026-07-05). For AI agents, see the authoritative `.agents/` hierarchy below.**

<!-- Redirect: use `.agents/AGENTS.md` as the primary AI-readable doc -->

**Generated:** 2026-07-05 (stale — see `.agents/` for current docs)
**Branch:** main

## OVERVIEW
Full-stack e-commerce marketplace with 19 microservices (Spring Boot, NestJS, Python), React SPA, and Flutter mobile app for the Vietnamese market. Payment providers: COD, VietQR, SePay (live); Stripe, PayPal (sandbox); MoMo, VNPay (disabled).

## AI-AGENTS: USE `.agents/` HIERARCHY
```
.agents/AGENTS.md          ← Start here (root overview, service port map, tech stack)
├── .agents/fe/AGENTS.md         ← React SPA details
├── .agents/vnshop_mobile/AGENTS.md ← Flutter mobile details
├── .agents/infra/AGENTS.md      ← Docker, Kafka, Prometheus, Grafana, scripts
├── .agents/proto/AGENTS.md      ← gRPC Buf-managed contracts
└── services/AGENTS.md           ← Per-service inventory and patterns
```

## KEY DOCS
| Doc | What it covers |
|-----|----------------|
| `.agents/AGENTS.md` | Service port map, Java 25 / Spring Boot 4.1.0 / NestJS 11 / Flutter 3.44 |
| `services/AGENTS.md` | 19 services, test commands, Java patterns |
| `services/order-service/AGENTS.md` | gRPC clients, Kafka, Redis, JaCoCo |
| `services/payment-service/AGENTS.md` | Payment provider toggles via env vars |
| `README.md` | Primary human-readable documentation |

## QUICK START
```bash
docker compose --profile apps up -d
bash infra/scripts/setup-keycloak-admin-client.sh
bash infra/scripts/init-kafka-topics.sh
node infra/scripts/seed-demo.mjs
```

## STALE CONTENT (for reference only)
```
Services:  fe/  services/  infra/  proto/  vnshop_mobile/
Java:      Spring Boot 4.1.0 (NOT 3.x), Java 25
Node:      NestJS 11 (NOT NestJS 10)
Frontend:  React 18 SPA + Flutter 3.44 mobile
Payments:  COD, VietQR, SePay live; MoMo, VNPay, Stripe, PayPal sandbox
Shipping:  GHN/GHTK adapters (live code, CARRIER_MODE=stub default)
Kafka:     SASL_PLAINTEXT, per-service ACLs, 8.2.0
```

## ANTI-PATTERNS
- **NEVER** commit secrets — `.env` excluded via `.gitignore`
- **NEVER** expose internal ports (8081-8098) — route through gateway `:8080`
- **DO NOT** use synchronous Kafka producers in hot paths
- **MUST** use tmpfs for video transcoding staging
- `KAFKA_VIDEO_TRANSPARECTOR_PASSWORD` and `KAFKA_VIDEO_MODERATOR_PASSWORD` have NO defaults — CI fails without them

## NOTES
- Gateway: `http://localhost:8080`
- Keycloak: `http://localhost:8085` (admin/admin)
- MinIO console: `http://localhost:9000` (vnshop/vnshop123)
- Jaeger tracing: `http://localhost:16686`
- Alertmanager: `http://localhost:9093`

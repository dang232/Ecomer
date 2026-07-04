# VNShop Backend Services — Deployment Analysis for Dokploy

> **Generated:** 2026-07-03 | **Stack:** Spring Boot 4.0.6 + Java 25 (except invoice-service: Java 21, payment-service: Java 17)

---

## Overview

11 backend Java services analyzed. All share a common infrastructure foundation with per-service specialization.

### Common Infrastructure Dependencies (All Services)

| Dependency | Type | Notes |
|---|---|---|
| **PostgreSQL** | Database | Per-service schema, pool sizes 3-20 |
| **Redis** | Cache | Shared across services; maxmemory 512MB |
| **Kafka** | Message Broker | SASL_PLAINTEXT; per-service credentials |
| **Keycloak** | Auth (OAuth2/OIDC) | JWT validation, issuer-uri + jwk-set-uri |
| **OpenTelemetry Agent** | Observability | Auto-injected via `-javaagent` |
| **Prometheus/Micrometer** | Metrics | `/actuator/prometheus` |
| **Jaeger/OTLP** | Tracing | `/actuator/traces` |
| **Flyway** | Migrations | Auto-run on startup |
| **Configuration Service** | Feature Config | HTTP poll for external config |

---

## Service-by-Service Deep Analysis

---

### 1. user-service

| Attribute | Value |
|---|---|
| **Port** | 8081 |
| **Java** | 25 |
| **Spring Boot** | 4.0.6 |
| **DB Pool** | HikariCP: min=5, max=20, timeout=3s |
| **DB Schema** | `vnshop_user.user_svc` |
| **DB Port (host)** | 5433 |
| **Redis** | Yes (shared) |
| **Kafka** | Yes (SASL_PLAINTEXT, `svc-user` creds) |
| **S3/MinIO** | Yes — avatar storage |
| **OAuth2** | JWT Resource Server |
| **Feature Flags** | Unleash client 9.2.4 |
| **Memory Limit** | 768MB |
| **Health Endpoint** | `GET /actuator/health` |
| **Dockerfile Base** | `maven:3.9.11-eclipse-temurin-25-alpine` → `eclipse-temurin:25-jre-alpine` |

#### Dependencies Summary
- `spring-boot-starter-actuator`, `micrometer-registry-prometheus`
- `spring-boot-starter-data-jpa`, `spring-boot-starter-flyway`
- `spring-boot-starter-validation`, `spring-boot-starter-webmvc`
- `spring-boot-starter-oauth2-resource-server`
- `spring-boot-starter-kafka`
- `resilience4j-spring-boot3` (circuit breaker)
- `caffeine` (local cache)
- `aws-java-sdk-s3` (v2.25.70)
- `unleash-client-java` (9.2.4)
- `flyway-database-postgresql`
- `logstash-logback-encoder` (8.0)
- OpenTelemetry Java Agent 2.27.0

#### External Service Calls
- **Keycloak** — JWT validation (jwks endpoint)
- **Product Service** — via circuit-breaker + retry (port 8082)
- **MinIO/S3** — avatar file storage
- **Unleash** — feature flag evaluation

#### Startup Requirements / Health Checks
```
depends_on:
  - postgres-user (healthy)
  - redis (healthy)
  - kafka (healthy)
```
- Flyway migrations run automatically
- Readiness: DB + Kafka readiness state
- Liveness: LivenessState only
- Circuit breaker indicator enabled

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8081 → 8081 |
| **DB connection** | Override `SPRING_DATASOURCE_URL`, `POSTGRES_PASSWORD` |
| **Redis** | Set `REDIS_HOST`, `REDIS_PASSWORD` |
| **Kafka** | Set `KAFKA_BOOTSTRAP_SERVERS`, `KAFKA_SVC_*_PASSWORD` |
| **Keycloak** | Set `KEYCLOAK_ISSUER_URI`, `KEYCLOAK_JWK_SET_URI` |
| **OTEL** | Set `MANAGEMENT_OTLP_TRACING_ENDPOINT` |
| **S3 Storage** | Set `VNSHOP_USER_STORAGE_*` (MinIO or R2) |
| **Unleash** | Set Unleash server URL if used |
| **Health Check** | Dokploy default HTTP check on 8081 ✓ |
| **Memory** | 768MB limit ✓ |

---

### 2. product-service

| Attribute | Value |
|---|---|
| **Port** | 8082 |
| **Java** | 25 |
| **Spring Boot** | 4.0.6 |
| **DB Pool** | HikariCP: min=5, max=15, timeout=3s |
| **DB Schema** | `vnshop_product.product_svc` |
| **DB Port (host)** | 5434 |
| **Redis** | Yes (shared, 300s cache TTL) |
| **Kafka** | Yes (SASL_SSL, `svc-product` creds) |
| **S3/MinIO** | Yes — product images + video staging |
| **OAuth2** | JWT Resource Server |
| **Memory Limit** | 768MB |
| **Health Endpoint** | `GET /actuator/health` |
| **Dockerfile Base** | `maven:3.9.11-eclipse-temurin-25-alpine` → `eclipse-temurin:25-jre-alpine` |

#### Dependencies Summary
- All standard starters + JPA, Flyway, Kafka, Redis
- `spring-boot-starter-data-redis`
- `aws-java-sdk-s3` (v2.25.70)
- `spring-boot-starter-oauth2-resource-server`
- `owasp-java-html-sanitizer` (20260101.1)
- `logstash-logback-encoder` (8.0)
- OpenTelemetry Java Agent 2.27.0

#### External Service Calls
- **Keycloak** — JWT validation
- **Redis** — product cache
- **Kafka** — product events producer
- **MinIO/S3** — product images, video staging

#### Startup Requirements
```
depends_on:
  - postgres-product (healthy)
  - redis (healthy)
  - kafka (healthy)
  - configuration-service (healthy)
```
- tmpfs mount: `/tmp/video-uploads:size=6G,noexec` (video upload staging)
- Kafka SSL truststore mount: `kafka.truststore.jks`

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8082 → 8082 |
| **DB** | Override datasource URL + credentials |
| **Redis** | `SPRING_DATA_REDIS_HOST`, `SPRING_DATA_REDIS_PORT` |
| **Kafka** | Bootstrap servers + SASL credentials |
| **Configuration Service** | `CONFIG_SERVICE_URL` (8097) |
| **S3/Object Storage** | `OBJECT_STORAGE_*` env vars |
| **tmpfs** | Map to Docker tmpfs or ephemeral storage |
| **Health Check** | Dokploy HTTP check ✓ |

---

### 3. order-service

| Attribute | Value |
|---|---|
| **Port** | 8091 |
| **Java** | 25 |
| **Spring Boot** | 4.0.6 |
| **DB Pool** | HikariCP: min=5, max=20, timeout=3s |
| **DB Schema** | `vnshop_order.order_svc` |
| **DB Port (host)** | 5435 |
| **Redis** | Yes (shared) |
| **Kafka** | Yes (SASL_SSL, `svc-order` creds) |
| **gRPC Server** | Yes (imports `application-grpc.yml`) |
| **OAuth2** | JWT Resource Server |
| **S3/MinIO** | Yes — invoice storage |
| **Memory Limit** | 768MB |
| **Health Endpoint** | `GET /actuator/health` |
| **Dockerfile Base** | `maven:3.9.11-eclipse-temurin-25` → `eclipse-temurin:25-jre-alpine` |

#### gRPC Configuration (application-grpc.yml)
```yaml
grpc:
  client:
    inventory: localhost:9093    # GRPC_CLIENT_INVENTORY_HOST/PORT
    payment:   localhost:9094    # GRPC_CLIENT_PAYMENT_HOST/PORT
    shipping:  localhost:9095    # GRPC_CLIENT_SHIPPING_HOST/PORT
```

#### Key Dependencies
- All standard starters
- `spring-boot-starter-data-redis`
- `spring-boot-starter-kafka`
- `resilience4j-circuitbreaker` + `resilience4j-micrometer`
- `spring-retry` (2.0.11)
- gRPC/Protobuf (1.81.0 / 3.25.5)
- `opentelemetry-api` (1.45.0)
- `aws-java-sdk-s3` (v2.25.70)
- **Outbox Pattern**: publisher poll-interval 1000ms, batch-size 50
- **Saga**: compensation-timeout 300s, finalizer-interval 60s

#### External Service Calls (gRPC)
- **Inventory Service** — `inventory:9093` (circuit breaker: 50% failure rate, 10s open)
- **Payment Service** — `payment:9094` (circuit breaker: 50% failure rate, 15s open)
- **Shipping Service** — `shipping:9095` (circuit breaker: 50% failure rate, 10s open)
- **Coupon Service** — HTTP `coupon-service:8088`

#### Startup Requirements
```
depends_on:
  - postgres-order (healthy)
  - redis (healthy)
  - kafka (healthy)
  - configuration-service (healthy)
  - inventory-service (healthy) — gRPC client
  - payment-service (healthy)    — gRPC client
  - shipping-service (healthy)   — gRPC client
```

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8091 → 8091 |
| **gRPC Ports** | 9093 (inventory), 9094 (payment), 9095 (shipping) must be exposed or accessible |
| **DB + Redis + Kafka** | Standard overrides |
| **Configuration Service** | `CONFIG_SERVICE_URL` |
| **Invoice S3 Storage** | `VNSHOP_INVOICE_STORAGE_*` |
| **Kafka SSL** | Truststore mount if SASL_SSL used |
| **Health Check** | Dokploy HTTP check ✓ |

**⚠️ CRITICAL for Dokploy:** order-service is a **gRPC client** — it calls other services via gRPC. Those services MUST be in the same Docker network or accessible. Dokploy may need custom networking or sidecar configuration.

---

### 4. payment-service

| Attribute | Value |
|---|---|
| **Port** | 8092 |
| **Java** | 17 ⚠️ |
| **Spring Boot** | 4.0.6 |
| **DB Pool** | HikariCP: min=5, max=15, timeout=3s |
| **DB Schema** | `vnshop_payment.payment_svc` |
| **DB Port (host)** | 5436 |
| **Kafka** | Yes (SASL_SSL, `svc-payment` creds) |
| **gRPC Server** | Yes (port 9094) |
| **OAuth2** | JWT Resource Server |
| **Memory Limit** | 768MB |
| **Health Endpoint** | `GET /actuator/health` |
| **Dockerfile Base** | `maven:3.9.11-eclipse-temurin-25` → `eclipse-temurin:25-jre-alpine` |

> ⚠️ **Java Version Mismatch**: pom.xml declares `<java.version>17</java.version>` but Dockerfile uses `eclipse-temurin-25`. This is an inconsistency — the Dockerfile should use Java 17 to match pom.xml.

#### Dependencies Summary
- All standard starters + JPA, Flyway, Kafka
- `spring-retry` (2.0.11)
- `caffeine` (local caching)
- `stripe-java` (32.1.0) — **external payment provider**
- gRPC/Protobuf (1.81.0 / 3.25.5)
- `logstash-logback-encoder` (8.0)
- `opentelemetry-api` (1.45.0)

#### Payment Providers (External)
| Provider | Default | Requires Creds |
|---|---|---|
| COD | ✅ ON | None |
| VietQR | ✅ ON | Bank account |
| VNPay | OFF | `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` |
| MoMo | OFF | `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` |
| Stripe | OFF | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal | OFF | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| SePay | OFF | `SEPAY_API_KEY`, `SEPAY_ACCOUNT_ID` |
| Frankfurter FX | ON | None (free ECB rates) |

#### Startup Requirements
```
depends_on:
  - postgres-payment (healthy)
  - redis (healthy)
  - kafka (healthy)
  - configuration-service (healthy)
```

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8092 → 8092 |
| **gRPC port** | 9094 for order-service to call |
| **Payment Provider Creds** | Set per-provider env vars as needed |
| **VietQR Bank Config** | `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME` |
| **FX Rate** | `FX_FALLBACK_RATE` (default 25500 VND/USD) |
| **Kafka SSL** | Truststore mount if SASL_SSL |
| **Health Check** | Dokploy HTTP check ✓ |

---

### 5. inventory-service

| Attribute | Value |
|---|---|
| **Port** | 8083 |
| **Java** | 25 |
| **Spring Boot** | 4.0.6 |
| **DB Pool** | HikariCP: min=5, max=15, timeout=3s |
| **DB Schema** | `vnshop_inventory.inventory_svc` |
| **DB Port (host)** | 5437 |
| **Redis** | Yes (shared) |
| **Kafka** | Yes (SASL_SSL, `svc-inventory` creds) |
| **gRPC Server** | Yes (port 9093) |
| **OAuth2** | JWT Resource Server |
| **Memory Limit** | 768MB |
| **Health Endpoint** | `GET /actuator/health` |
| **Dockerfile Base** | `maven:3.9.11-eclipse-temurin-25` → `eclipse-temurin:25-jre-alpine` |

#### External Service Calls
- **Redis** — inventory caching
- **Kafka** — inventory events

#### Startup Requirements
```
depends_on:
  - postgres-inventory (healthy)
  - redis (healthy)
  - kafka (healthy)
  - configuration-service (healthy)
```

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8083 → 8083 |
| **gRPC port** | 9093 for order-service to call |
| **DB + Redis + Kafka** | Standard overrides |
| **Kafka SSL** | Truststore mount |
| **Health Check** | Dokploy HTTP check ✓ |

---

### 6. shipping-service

| Attribute | Value |
|---|---|
| **Port** | 8093 |
| **Java** | 25 |
| **Spring Boot** | 4.0.6 |
| **DB Pool** | HikariCP: min=3, max=10, timeout=3s |
| **DB Schema** | `vnshop_shipping.shipping_svc` |
| **DB Port (host)** | 5439 |
| **Kafka** | Yes (SASL_SSL, `svc-shipping` creds) |
| **gRPC Server** | Yes (port 9095) |
| **OAuth2** | JWT Resource Server |
| **Security** | `spring-boot-starter-security` (additional to OAuth2 RS) |
| **Memory Limit** | 768MB |
| **Health Endpoint** | `GET /actuator/health` |
| **Dockerfile Base** | `maven:3.9.11-eclipse-temurin-25` → `eclipse-temurin:25-jre-alpine` |

#### Shipping Carriers (External)
| Carrier | Mode | Requires Creds |
|---|---|---|
| Stub | Default | None |
| GHN | Live | `GHN_TOKEN`, `GHN_SHOP_ID` |
| GHTK | Live | `GHTK_TOKEN`, `GHTK_PARTNER_CODE` |

#### Startup Requirements
```
depends_on:
  - postgres-shipping (healthy)
  - redis (healthy)
  - kafka (healthy)
  - configuration-service (healthy)
```

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8093 → 8093 |
| **gRPC port** | 9095 for order-service to call |
| **Carrier Mode** | `CARRIER_MODE=stub` (default) or `live` |
| **Carrier Creds** | GHN/GHTK tokens if live mode |
| **DB + Kafka** | Standard overrides |
| **Health Check** | Dokploy HTTP check ✓ |

---

### 7. search-service

| Attribute | Value |
|---|---|
| **Port** | 8086 |
| **Java** | 25 |
| **Spring Boot** | 4.0.6 |
| **DB Pool** | HikariCP: min=3, max=10, timeout=3s |
| **DB Schema** | `vnshop_search.search_svc` |
| **DB Port (host)** | 5438 |
| **Kafka** | Yes (SASL_PLAINTEXT, `svc-search` creds) |
| **Elasticsearch** | Yes — **critical dependency** |
| **OAuth2** | JWT Resource Server |
| **Memory Limit** | 768MB |
| **Health Endpoint** | `GET /actuator/health/readiness` |
| **Dockerfile Base** | `maven:3.9.11-eclipse-temurin-25-alpine` → `eclipse-temurin:25-jre-alpine` |

#### Dependencies Summary
- Standard starters + JPA, Flyway, Kafka
- `spring-boot-starter-data-elasticsearch` — **special dependency**
- `spring-retry` (2.0.11)
- Kafka health check disabled at consumer level
- `spring-boot-starter-kafka` admin auto-configuration excluded

#### External Service Calls
- **Elasticsearch** — `elasticsearch:9200` (requires `ELASTIC_PASSWORD`)
- **Kafka** — event consumption
- **Configuration Service** — config polling

#### Startup Requirements
```
depends_on:
  - postgres-search (healthy)
  - redis (healthy)
  - kafka (healthy)
  - elasticsearch (healthy) ← CRITICAL
  - configuration-service (healthy)
```

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8086 → 8086 |
| **Elasticsearch** | **Must provision ES cluster**; set `ELASTICSEARCH_HOST`, `ELASTIC_PASSWORD` |
| **DB + Kafka** | Standard overrides |
| **Health Check** | Uses `/actuator/health/readiness` ✓ (includes DB) |
| **Startup Order** | Search service needs ES fully ready |

---

### 8. seller-finance-service

| Attribute | Value |
|---|---|
| **Port** | 8090 |
| **Java** | 25 |
| **Spring Boot** | 4.0.6 |
| **DB Pool** | HikariCP: min=3, max=10, timeout=3s |
| **DB Schema** | `vnshop.seller_finance_svc` (shared DB) |
| **DB Port (host)** | 5432 (legacy) |
| **Kafka** | Yes (SASL_PLAINTEXT, `svc-finance` creds) |
| **OAuth2** | JWT Resource Server |
| **Memory Limit** | 768MB |
| **Health Endpoint** | `GET /actuator/health/readiness` |
| **Dockerfile Base** | `maven:3.9.11-eclipse-temurin-25-alpine` → `eclipse-temurin:25-jre-alpine` |

> ⚠️ **DB Sharing**: Uses `postgres-legacy` (port 5432) shared with multiple services. Not a per-service database.

#### Key Dependencies
- Standard starters + JPA, Flyway, Kafka
- `spring-retry` (2.0.11)
- **No OpenTelemetry agent** in build (missing from pom.xml)
- **No Redis** dependency

#### Startup Requirements
```
depends_on:
  - postgres-legacy (healthy)
  - redis (healthy)
  - kafka (healthy)
  - configuration-service (healthy)
```

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8090 → 8090 |
| **DB** | Points to shared `postgres-legacy` |
| **Kafka** | `KAFKA_SVC_FINANCE_PASSWORD` |
| **OTEL** | ⚠️ Missing agent in pom.xml — may need build fix |
| **Health Check** | Uses `/actuator/health/readiness` ✓ |

---

### 9. recommendations-service

| Attribute | Value |
|---|---|
| **Port** | 8094 |
| **Java** | 25 |
| **Spring Boot** | 4.0.6 |
| **DB Pool** | HikariCP: min=3, max=10, timeout=3s |
| **DB Schema** | `vnshop.recommendations_svc` (shared DB) |
| **DB Port (host)** | 5432 (legacy) |
| **Kafka** | Yes (SASL_PLAINTEXT, `svc-recommendations` creds) |
| **OAuth2** | None |
| **Memory Limit** | 768MB |
| **Health Endpoint** | `GET /actuator/health/readiness` |
| **Dockerfile Base** | `maven:3.9.11-eclipse-temurin-25-alpine` → `eclipse-temurin:25-jre-alpine` |

> ⚠️ **No OAuth2 Resource Server** — this service does not validate JWTs (BE-to-BE service only).

#### External Service Calls
- **Product Service** — HTTP `product-service:8082` for cross-service product lookups

#### Startup Requirements
```
depends_on:
  - postgres-legacy (healthy)
  - kafka (healthy)
  - configuration-service (healthy)
```

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8094 → 8094 |
| **DB** | Points to shared `postgres-legacy` |
| **Kafka** | `KAFKA_SVC_RECOMMENDATIONS_PASSWORD` |
| **Product Service URL** | `PRODUCT_SERVICE_URL` for recommendations lookups |
| **Health Check** | Uses `/actuator/health/readiness` ✓ |

---

### 10. invoice-service

| Attribute | Value |
|---|---|
| **Port** | 8098 |
| **Java** | 21 ⚠️ |
| **Spring Boot** | 3.4.5 ⚠️ (older version) |
| **DB Pool** | HikariCP: min=2, max=10, timeout=3s |
| **DB Schema** | `vnshop_invoice.invoice_svc` |
| **DB Port (host)** | 5441 |
| **Kafka** | Yes (SASL_PLAINTEXT, `svc-invoice` creds) |
| **OAuth2** | JWT Resource Server |
| **Memory Limit** | 512MB |
| **Health Endpoint** | `GET /actuator/health` |
| **Dockerfile Base** | `maven:3.9.6-eclipse-temurin-21` → `eclipse-temurin:21-jre-alpine` |

> ⚠️ **Version Inconsistencies**: This is the only service on Spring Boot 3.4.5 (others use 4.0.6) and Java 21 (others use 25). Dockerfile correctly uses Java 21. **No OpenTelemetry agent** in build (missing from pom.xml).

#### Key Dependencies
- Standard starters + JPA, Flyway, Kafka
- `jakarta.xml.bind-api` + `jaxb-runtime` — JAXB for XML marshalling (removed from JDK 11+)
- `jackson-datatype-jsr310` — Java 8 date/time support
- `spring-kafka` (not spring-boot-starter-kafka)
- **No Redis** dependency

#### Startup Requirements
```
depends_on:
  - postgres-invoice (healthy)
  - kafka (healthy)
  - configuration-service (healthy)
```

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8098 → 8098 |
| **Java Version** | Uses Java 21 — Dokploy must provision Java 21 image |
| **Spring Boot Version** | 3.4.5 — different from other services |
| **OTEL** | ⚠️ Missing agent in pom.xml — may need build fix |
| **DB + Kafka** | Standard overrides |
| **Health Check** | Dokploy HTTP check ✓ |

---

### 11. api-gateway

| Attribute | Value |
|---|---|
| **Port** | 8080 |
| **Java** | 25 |
| **Spring Boot** | 4.0.6 |
| **Redis** | Yes — reactive Redis (session/rate limiting) |
| **OAuth2** | Both Client + Resource Server |
| **Circuit Breakers** | Yes (Resilience4j) — 10 backend services |
| **Memory Limit** | 768MB |
| **Health Endpoint** | `GET /actuator/health` |
| **Dockerfile Base** | `maven:3.9.11-eclipse-temurin-25-alpine` → `eclipse-temurin:25-jre-alpine` |

#### Key Dependencies
- `spring-cloud-starter-gateway-server-webflux` — **reactive gateway**
- `spring-boot-starter-data-redis-reactive`
- `spring-boot-starter-security-oauth2-client` + `oauth2-resource-server`
- `spring-cloud-starter-circuitbreaker-reactor-resilience4j`
- `spring-cloud.version` 2025.1.1

#### Circuit Breaker Instances
- product-service, search-service, inventory-service, user-service
- cart-service, order-service, payment-service, shipping-service
- notification-service, recommendations-service, messaging-service

#### External Service Calls
- **Keycloak** — JWT validation + OAuth2 token introspection
- **Redis** — rate limiting + session caching
- **All backend services** — proxied through gateway routes

#### Startup Requirements
```
depends_on:
  - redis (healthy)
  - keycloak (healthy)
```

#### CORS Configuration
```yaml
allowed-origins: ${GATEWAY_CORS_ALLOWED_ORIGINS:http://localhost:3000,http://localhost:5173}
allowed-methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
allow-credentials: false
max-age: 3600
```

#### Dokploy Adaptation Needs
| Item | Action Required |
|---|---|
| **Port mapping** | 8080 → 8080 (primary entry point) |
| **Redis** | `REDIS_HOST`, `REDIS_PASSWORD` |
| **Keycloak** | `KEYCLOAK_ISSUER_URI`, `KEYCLOAK_JWK_SET_URI` |
| **CORS** | Set `GATEWAY_CORS_ALLOWED_ORIGINS` for production |
| **Health Check** | Dokploy HTTP check ✓ |
| **Routing** | Verify route configs match Dokploy network |

---

## Resource Usage Summary

| Service | Port | Java | Memory | DB Pool | Redis | Kafka | gRPC | Special |
|---|---|---|---|---|---|---|---|---|
| api-gateway | 8080 | 25 | 768MB | — | ✅ | — | — | Reactive GW |
| user-service | 8081 | 25 | 768MB | 5-20 | ✅ | ✅ | — | S3, Unleash |
| product-service | 8082 | 25 | 768MB | 5-15 | ✅ | ✅ | — | S3, tmpfs |
| inventory-service | 8083 | 25 | 768MB | 5-15 | ✅ | ✅ | ✅ 9093 | — |
| search-service | 8086 | 25 | 768MB | 3-10 | ✅ | ✅ | — | Elasticsearch |
| seller-finance | 8090 | 25 | 768MB | 3-10 | — | ✅ | — | Shared DB |
| order-service | 8091 | 25 | 768MB | 5-20 | ✅ | ✅ | ✅ 9093-5 | Outbox, Saga |
| payment-service | 8092 | **17** ⚠️ | 768MB | 5-15 | — | ✅ | ✅ 9094 | Stripe, VNPay |
| shipping-service | 8093 | 25 | 768MB | 3-10 | — | ✅ | ✅ 9095 | GHN/GHTK |
| recommendations | 8094 | 25 | 768MB | 3-10 | — | ✅ | — | Shared DB |
| invoice-service | 8098 | **21** ⚠️ | 512MB | 2-10 | — | ✅ | — | XML/JAXB |

---

## Shared Infrastructure Services

These are **not** Spring Boot services but are required dependencies:

| Service | Image | Memory | Required By |
|---|---|---|---|
| postgres-legacy | postgres:17.9 | 512MB | seller-finance, recommendations, messaging, coupon |
| postgres-keycloak | postgres:17.9 | 512MB | Keycloak |
| postgres-user | postgres:17.9 | 512MB | user-service |
| postgres-product | postgres:17.9 | 512MB | product-service |
| postgres-order | postgres:17.9 | 512MB | order-service |
| postgres-payment | postgres:17.9 | 512MB | payment-service |
| postgres-inventory | postgres:17.9 | 512MB | inventory-service |
| postgres-search | postgres:17.9 | 512MB | search-service |
| postgres-shipping | postgres:17.9 | 512MB | shipping-service |
| postgres-cart | postgres:17.9 | 512MB | cart-service |
| postgres-invoice | postgres:17.9 | 512MB | invoice-service |
| redis | redis:8.6-alpine | 256MB | All caching services |
| kafka | confluent/cp-kafka:8.2.0 | 1536MB | All services |
| keycloak | quay.io/keycloak/keycloak:26.6 | 768MB | All OAuth2 services |
| elasticsearch | elasticsearch:9.4.0 | 1GB | search-service |
| minio | minio/minio:RELEASE.2025 | — | S3-compatible storage |
| configuration-service | custom | — | Most services |

---

## Dokploy-Specific Adaptation Checklist

### Critical Issues to Address

#### 1. Java Version Inconsistencies
- **payment-service**: pom.xml says Java 17, Dockerfile uses Java 25 → **fix Dockerfile to Java 17**
- **invoice-service**: pom.xml says Java 21, Dockerfile correctly uses Java 21 → **deploy with Java 21 image**

#### 2. OpenTelemetry Agent
- **seller-finance-service** and **invoice-service**: Missing from pom.xml build plugins → **add OTEL agent injection**
- All other services have `spring-boot-maven-plugin` with `-javaagent` configuration

#### 3. gRPC Service Communication
- order-service calls inventory/payment/shipping via gRPC on ports 9093-9095
- All three target services must be in the same Dokploy project/network
- May need to expose gRPC ports or configure internal networking

#### 4. Elasticsearch
- search-service is tightly coupled to Elasticsearch 9.4.0
- Must provision ES before deploying search-service
- Consider ES as a separate Dokploy managed service or external provision

#### 5. Kafka Configuration
- Multiple security protocols: `SASL_PLAINTEXT` and `SASL_SSL`
- SSL truststore (`kafka.truststore.jks`) mounted as volume
- Per-service Kafka credentials required

### Environment Variables to Set Per Service

```
# Core
SPRING_DATASOURCE_URL=jdbc:postgresql://<host>:5432/<db>
SPRING_DATASOURCE_USERNAME=vnshop
POSTGRES_PASSWORD=<strong-password>

# Redis
REDIS_HOST=<redis-host>
REDIS_PASSWORD=<redis-password>

# Kafka
KAFKA_BOOTSTRAP_SERVERS=<kafka-host>:9092
KAFKA_SECURITY_PROTOCOL=SASL_PLAINTEXT
KAFKA_SASL_USERNAME=svc-<name>
KAFKA_SASL_PASSWORD=<kafka-password>

# Keycloak
KEYCLOAK_ISSUER_URI=https://<keycloak-host>/realms/vnshop
KEYCLOAK_JWK_SET_URI=http://<keycloak-host>:8080/realms/vnshop/protocol/openid-connect/certs

# OpenTelemetry
MANAGEMENT_OTLP_TRACING_ENDPOINT=http://<otel-collector>:4318/v1/traces
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0

# Object Storage (optional)
VNSHOP_OBJECT_STORAGE_PROFILE=MINIO  # or R2
VNSHOP_OBJECT_STORAGE_ENDPOINT=http://<minio-host>:9000
VNSHOP_OBJECT_STORAGE_ACCESS_KEY=<access-key>
VNSHOP_OBJECT_STORAGE_SECRET_KEY=<secret-key>
```

### Volume Mounts Required

| Mount | Service | Purpose |
|---|---|---|
| `kafka.truststore.jks` | product, order, payment, inventory, shipping, search | Kafka SSL truststore |
| `/tmp/video-uploads` | product-service | Video upload staging (6GB tmpfs) |

### Health Check Configuration

All services expose health endpoints. Dokploy's built-in HTTP health checks are compatible:
- Most: `GET /actuator/health`
- search/seller-finance/recommendations: `GET /actuator/health/readiness`

---

## Startup Order (Dependency Graph)

```
Level 0 (Infrastructure):
  → Kafka
  → Redis
  → PostgreSQL instances
  → Keycloak
  → Elasticsearch (for search-service)

Level 1 (Foundation):
  → configuration-service
  → inventory-service (gRPC server: 9093)
  → payment-service (gRPC server: 9094)
  → shipping-service (gRPC server: 9095)

Level 2 (Depends on gRPC servers):
  → order-service (gRPC clients → inventory/payment/shipping)

Level 3 (Core business):
  → user-service
  → product-service
  → search-service (needs Elasticsearch)
  → seller-finance-service
  → recommendations-service
  → invoice-service

Level 4 (API):
  → api-gateway
```

---

## Notes

- **payment-service Dockerfile inconsistency**: pom.xml specifies Java 17, Dockerfile uses Java 25. Fix to Java 17 or update pom.xml to match.
- **invoice-service version lag**: Only service on Spring Boot 3.4.5 + Java 21 — isolated upgrade path needed.
- **seller-finance + recommendations share postgres-legacy**: Schema isolation via `currentSchema` but same DB instance — acceptable for Dokploy with connection pooling.
- **Local Kafka SASL config differs from staging**: Services use `SASL_PLAINTEXT` for most, `SASL_SSL` for some. Align Kafka listener security protocols for Dokploy.
- **Jaeger endpoints hardcoded to localhost**: All services reference `localhost:14250` for Jaeger — must be overridden via env vars in Dokploy.

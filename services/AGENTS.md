# Backend Microservices (services/)

**Stack:** Spring Boot 4.1.0 (Java 25), NestJS 11 (TypeScript), Python, Kafka, PostgreSQL, Redis

## SERVICE INVENTORY
| Service | Stack | Port | Purpose |
|---------|-------|------|---------|
| api-gateway | Spring Cloud | 8080 | OAuth2, routing, rate limiting |
| user-service | Spring Boot | 8081 | User/seller profiles, payout destination enrollment (masked) |
| seller-finance-service | Spring Boot | 8090 | Active owner of marketplace settlement, ledger, wallet projection, payouts |
| product-service | Spring Boot | 8082 | Catalog, variants, inventory |
| cart-service | NestJS | 8084 | Multi-seller cart snapshots |
| order-service | Spring Boot | 8091 | Orders, fulfillment, immutable per-sub-order financial allocations, Kafka workers |
| payment-service | Spring Boot | 8092 | VNPay, MoMo, VietQR, COD |
| shipping-service | Spring Boot | 8093 | GHN/GHTK carrier integration |
| search-service | NestJS | 8086 | Elasticsearch, faceted search |
| notification-service | NestJS | 8087 | Email, SMS, push, in-app |
| video-transcoder | Spring Boot | - | FFmpeg video processing |
| video-moderator | Python | - | ML content moderation |

## JAVA SERVICES PATTERN
```
services/<name>/
├── src/main/java/com/vnshop/<svc>/
│   ├── controller/       # REST endpoints
│   ├── service/          # Business logic
│   ├── repository/       # JPA repositories
│   ├── domain/          # Entity classes
│   ├── dto/             # Data transfer objects
│   └── config/          # Spring config
├── src/main/resources/
│   └── db/migration/    # Flyway migrations
├── Dockerfile
└── pom.xml
```

## NODE SERVICES PATTERN (NestJS)
```
services/<name>/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   └── *.module.ts      # Feature modules
├── Dockerfile
├── package.json
└── tsconfig.json
```

## TESTING
- **Java**: JUnit 5, Spring Boot Test, `@WebMvcTest`, 90% coverage gate via JaCoCo
- **Node**: Jest, NestJS Testing module
- **Excluded from CI**: ApplicationTests, ArchitectureRulesTest, *PactTest, Grpc*ServerTest

## GRPC (proto/)
- Proto definitions in `proto/` directory
- Buf for linting and breaking change detection
- Services: inventory, payment, shipping gRPC communication

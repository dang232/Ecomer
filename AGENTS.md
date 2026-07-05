# VNShop E-Commerce Platform

**Generated:** 2026-07-05
**Commit:** latest
**Branch:** main

## OVERVIEW
Full-stack e-commerce marketplace with 21+ microservices (Spring Boot, NestJS, React) and a React frontend. Vietnamese market focus with payment providers (VNPay, MoMo, VietQR, COD).

## STRUCTURE
```
Full-Stack-E-commerce/
├── fe/                    # React + Vite + TypeScript frontend
├── services/              # 21 microservices (Java, Node, Python)
│   ├── api-gateway/      # Spring Cloud Gateway (port 8080)
│   ├── user-service/     # Spring Boot user/auth (8081)
│   ├── product-service/  # Spring Boot catalog (8082)
│   ├── order-service/    # Spring Boot orders (8091)
│   ├── payment-service/  # Spring Boot payments (8092)
│   ├── shipping-service/  # Spring Boot shipping (8093)
│   ├── cart-service/     # NestJS cart (8084)
│   ├── notification-svc/ # NestJS notifications (8087)
│   ├── search-service/   # NestJS + Elasticsearch (8086)
│   └── ...               # 12+ more services
├── infra/                # Docker, Kafka, monitoring, IaC
├── proto/                # gRPC protocol buffers
└── docker-compose.yml    # Full stack orchestration
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Frontend work | `fe/` | React 18, Vite, TypeScript, Tailwind |
| Java services | `services/*/` | Spring Boot, Maven, port 8081-8094 |
| Node services | `services/{cart,notification,config}*/` | NestJS, TypeScript |
| Infrastructure | `infra/` | Kafka, Prometheus, Grafana, Docker |
| Proto/gRPC | `proto/` | shared between Java services |
| Local dev | `docker-compose.yml` | Full stack in Docker |

## CONVENTIONS (THIS PROJECT)
- **Java**: Spring Boot 3.x, Java 25, Maven, Flyway migrations, Kafka for async
- **Node**: NestJS, TypeScript strict mode, tsconfig path aliases
- **Frontend**: Feature-based structure, Zustand stores, React Query, Vitest tests
- **Testing**: Vitest (FE), JUnit 5 (Java), Playwright (E2E), 90% coverage gate
- **Auth**: Keycloak OAuth2, JWT validation at gateway
- **Ports**: Gateway 8080, Java services 8081-8094, Node services 8084/8087
- **Proto**: Buf for gRPC IDL management, breaking change detection in CI

## ANTI-PATTERNS (THIS PROJECT)
- **NEVER commit secrets** to `secrets.env.local.example` or any file
- **NEVER expose internal ports** (8081-8094) - access via gateway only
- **DO NOT** use synchronous Kafka producers in hot paths
- **DO NOT** commit `.env` files - only `.env.example` or `.env.local.example`
- **MUST** use tmpfs for video transcoding staging directories
- **MUST NOT** set `dev` profile for production builds
- **KAFKA_VIDEO_TRANSCODER_PASSWORD** and **KAFKA_VIDEO_MODERATOR_PASSWORD** have NO defaults - CI fails without them

## UNIQUE STYLES
- Ponytail comments: inline notes like `# ponytail: internal only` explain design decisions
- Superpowers: `/gsd` commands for agentic workflow (GSD framework)
- S3-compatible storage: MinIO for local dev, Cloudflare R2 for production
- Multi-broker Kafka: single broker locally (replica=1), 3-broker StatefulSet in prod

## COMMANDS
```bash
# Full stack
make up                    # Start all services
make down                  # Stop all

# Java services
make test-java s=<svc>     # Test specific Java service
cd services/<svc> && ./mvnw test

# Frontend
cd fe && npm run dev       # Dev server (port 3000)
cd fe && npm test           # Unit tests
cd fe && npx playwright test # E2E tests

# Build
cd services/<svc> && ./mvnw package -DskipTests
```

## NOTES
- MinIO console: http://localhost:9001 (default creds: vnshop/vnshop123)
- Keycloak: http://localhost:8085 (admin/admin)
- Grafana: http://localhost:3001 (admin/vnshop123)
- Jaeger tracing: http://localhost:16686
- Kafka: SASL_PLAINTEXT on port 29092 (local), 9092 (internal)

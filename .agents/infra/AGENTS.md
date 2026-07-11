<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# Infrastructure (infra/)

## Purpose
Infrastructure-as-code, operational scripts, Docker orchestration, Kafka configuration, monitoring stack, and deployment tooling for the VNShop platform.

## Key Files
| File | Description |
|------|-------------|
| `scripts/e2e-day.mjs` | 65/65 endpoint API smoke test suite |
| `scripts/seed-demo.mjs` | Demo catalog seeder (skips if non-empty; `FORCE=1` to overwrite) |
| `scripts/setup-keycloak-admin-client.sh` | One-time Keycloak admin client setup (idempotent) |
| `scripts/init-kafka-topics.sh` | Pre-creates Kafka topics + ACLs (idempotent) |
| `scripts/backup.sh` / `restore.sh` | Postgres backup/restore utilities |
| `scripts/deploy-staging.sh` | Staging deployment script |
| `scripts/backup-cron.sh` | Cron-based backup automation |
| `scripts/kafka-partition-scale.sh` | Kafka partition scaling utility |
| `scripts/validate-istio-call-graph.sh` | Istio service graph validation |
| `kafka/certs/` | Kafka SSL/SASL certificates |
| `kafka/kafka_server_jaas.conf` | Kafka JAAS config for SASL authentication |
| `kafka/server.properties` | Kafka broker configuration |
| `prometheus/prometheus.yml` | Prometheus scrape config |
| `prometheus/rules.yml` | Prometheus alerting rules |
| `prometheus/slo-rules.yml` | SLO-based alerting rules |
| `prometheus/prometheus-k8s.yml` | Kubernetes Prometheus manifest |
| `compose/` | Docker Compose override fragments |
| `postgres/` | Postgres backup and migration tooling |
| `promtail/` | Loki log collection config |
| `grafana/` | Grafana dashboard configs |
| `alertmanager/` | Alertmanager config |
| `loki/` | Loki log aggregation config |
| `redis/` | Redis HA configuration |
| `terraform/` | Terraform IaC for cloud deployment |
| `helm/` | Kubernetes Helm charts |
| `k8s/` | Kubernetes manifests |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `infra/scripts/` | Operational shell scripts and Node.js test utilities |
| `infra/kafka/` | Kafka broker config, JAAS, SSL certs, SASL ACLs |
| `infra/prometheus/` | Prometheus scrape configs and alerting rules |
| `infra/compose/` | Docker Compose override fragments |
| `infra/postgres/` | Postgres backup and migration tooling |
| `infra/redis/` | Redis HA cluster config |
| `infra/grafana/` | Grafana dashboard provisioning |
| `infra/alertmanager/` | Alertmanager routing config |
| `infra/loki/` | Loki log aggregation |
| `infra/promtail/` | Promtail log collector config |
| `infra/terraform/` | Cloud infrastructure (Cloudflare R2, etc.) |
| `infra/helm/` | Kubernetes Helm charts |
| `infra/k8s/` | Kubernetes manifests |
| `infra/backups/` | Backup artifacts and retention policies |
| `infra/load-tests/` | k6 load testing scripts and configs |
| `infra/auth/` | Auth-related infra configs |
| `infra/secrets/` | Secret management tooling |
| `infra/service-split-assessment/` | Service decomposition analysis docs |

## For AI Agents

### Working In This Directory
- All shell scripts assume bash (Git Bash on Windows is fine)
- Kafka SASL credentials are stored in `.env` and injected via `docker-compose.yml`
- Run `setup-keycloak-admin-client.sh` after first `docker compose up`
- Run `init-kafka-topics.sh` before starting services that consume Kafka topics
- e2e-day.mjs requires all services to be running via `docker compose --profile apps`

### Testing Requirements
- `bash infra/scripts/validate-istio-call-graph.sh` to validate service mesh topology
- `bash infra/scripts/kafka-partition-scale.sh` to verify Kafka partition assignments
- E2E suite must pass before merging any service boundary or Kafka topic changes

### Common Patterns
- Docker Compose uses profile system (`--profile apps` for app services, `--profile legacy` for deprecated services)
- Kafka uses SASL_PLAINTEXT with per-service credentials and `StandardAuthorizer` ACLs
- Prometheus endpoint exposed on all Java services via Spring Actuator

## Dependencies

### Internal
- `docker-compose.yml` (root) — reads infra config for service definitions
- `.env` — Kafka credentials, MinIO keys, service ports

### External
- Docker Desktop — local container runtime
- Kafka (confluentinc/cp-kafka:8.2.0) — via docker-compose
- Prometheus — metrics collection
- Grafana — dashboards and alerting
- Jaeger — distributed tracing
- Loki + Promtail — log aggregation

<!-- MANUAL: -->

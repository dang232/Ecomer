# Infrastructure (infra/)

**Purpose:** Docker, Kubernetes, monitoring, IaC, and operational tooling

## STRUCTURE
```
infra/
├── compose/          # Docker Compose variants (staging, etc.)
├── kafka/           # Kafka SSL certs, JAAS config
├── k8s/            # Kubernetes manifests
├── prometheus/      # Metrics rules, alerting
├── grafana/        # Dashboards, provisioning
├── alertmanager/   # Alert routing
├── loki/          # Log aggregation
├── promtail/      # Docker log scraping
├── postgres/       # Init scripts
├── scripts/        # Operational scripts
└── keycloak/      # Realm configuration
```

## KEY COMPONENTS
- **Kafka**: Single broker locally (replica=1), 3-broker StatefulSet in prod
- **Monitoring**: Prometheus + Grafana + Jaeger tracing
- **Storage**: MinIO (local), Cloudflare R2 (production)
- **Auth**: Keycloak with realm config in `infra/keycloak/`

## LOCAL DEVELOPMENT
```bash
# All infra runs via docker-compose from root
make up                    # Start full stack
make logs s=<service>     # Tail service logs
```

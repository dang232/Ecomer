# Phase 3A: Observability Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## Goal

Complete the observability stack by adding the missing Prometheus container, Grafana with auto-provisioned dashboards, Loki + Promtail for centralized logging, and formal SLI/SLO definitions with error-budget burn-rate alerting. After this phase, all services emit metrics to Prometheus, ship logs to Loki, and both are queryable via Grafana with pre-built dashboards.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Docker Compose                                                      │
│                                                                      │
│  ┌──────────────┐    scrapes     ┌───────────────┐                  │
│  │ 11 Java svcs │ ◄──────────── │  Prometheus    │                  │
│  │ /actuator/   │               │  :9090         │                  │
│  │  prometheus  │               │  rules.yml     │                  │
│  └──────────────┘               │  slo-rules.yml │                  │
│                                  └───────┬───────┘                  │
│                                          │ datasource               │
│                                          ▼                          │
│  ┌──────────────┐  push logs   ┌───────────────┐   ┌────────────┐ │
│  │  Promtail    │ ────────────►│    Loki        │──►│  Grafana   │ │
│  │  (Docker     │              │    :3100       │   │  :3001     │ │
│  │   log files) │              └───────────────┘   │  4 dashboards│ │
│  └──────────────┘                                   └────────────┘ │
│                                                          │          │
│  ┌──────────────┐                                        │          │
│  │ AlertManager │ ◄─────── Prometheus fire alerts ───────┘          │
│  │  :9093       │                                                    │
│  └──────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Image | Port |
|-----------|-------|------|
| Prometheus | prom/prometheus:v2.53.0 | 9090 |
| Grafana | grafana/grafana:11.1.0 | 3001 (host) -> 3000 (container) |
| Loki | grafana/loki:3.1.0 | 3100 |
| Promtail | grafana/promtail:3.1.0 | - (no exposed port) |

## File Structure — All Files Created

```
infra/
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── datasources.yml
│   │   └── dashboards/
│   │       └── dashboards.yml
│   └── dashboards/
│       ├── red-metrics.json
│       ├── jvm-overview.json
│       ├── kafka-consumer-lag.json
│       ├── business-kpis.json
│       └── slo-overview.json
├── loki/
│   └── loki-config.yml
├── promtail/
│   └── promtail-config.yml
├── prometheus/
│   └── slo-rules.yml          (NEW — alongside existing rules.yml)
├── k8s/
│   └── base/
│       └── services/
│           ├── grafana/
│           │   ├── deployment.yaml
│           │   ├── service.yaml
│           │   └── kustomization.yaml
│           └── loki/
│               ├── deployment.yaml
│               ├── service.yaml
│               └── kustomization.yaml
docs/
└── sli-slo.md
```

---

## Task 1 (A1): Grafana Dashboards + Prometheus Container

### 1.1 Add Prometheus container to docker-compose.yml

- [ ] Add `prometheus` service definition to `docker-compose.yml` (insert BEFORE the existing `alertmanager` service block):

```yaml
  prometheus:
    image: prom/prometheus:v2.53.0
    container_name: vnshop-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./infra/prometheus/rules.yml:/etc/prometheus/rules.yml:ro
      - ./infra/prometheus/slo-rules.yml:/etc/prometheus/slo-rules.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
      - '--web.enable-lifecycle'
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:9090/-/healthy"]
      interval: 15s
      timeout: 5s
      retries: 10
```

- [ ] Add `prometheus-data` to the `volumes:` section at the bottom of docker-compose.yml:

```yaml
  prometheus-data:
```

- [ ] Update `infra/prometheus/prometheus.yml` to reference the new SLO rules file — change `rule_files:` section from:

```yaml
rule_files:
  - "rules.yml"
```

to:

```yaml
rule_files:
  - "rules.yml"
  - "slo-rules.yml"
```

### 1.2 Add Grafana container to docker-compose.yml

- [ ] Add `grafana` service definition to `docker-compose.yml` (insert AFTER `prometheus`):

```yaml
  grafana:
    image: grafana/grafana:11.1.0
    container_name: vnshop-grafana
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-vnshop123}
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_SERVER_ROOT_URL: http://localhost:3001
    volumes:
      - ./infra/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./infra/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana-data:/var/lib/grafana
    depends_on:
      prometheus:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 15s
      timeout: 5s
      retries: 10
```

- [ ] Add `grafana-data` to the `volumes:` section at the bottom of docker-compose.yml:

```yaml
  grafana-data:
```

### 1.3 Create Grafana datasources provisioning

- [ ] Create directory `infra/grafana/provisioning/datasources/`
- [ ] Create file `infra/grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      timeInterval: "15s"
      httpMethod: POST

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: false
    jsonData:
      maxLines: 1000
      derivedFields:
        - datasourceUid: jaeger
          matcherRegex: '"traceId":"(\w+)"'
          name: TraceID
          url: "$${__value.raw}"

  - name: Jaeger
    type: jaeger
    access: proxy
    uid: jaeger
    url: http://jaeger:16686
    editable: false
```

### 1.4 Create Grafana dashboard provisioning

- [ ] Create directory `infra/grafana/provisioning/dashboards/`
- [ ] Create file `infra/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: VNShop
    orgId: 1
    folder: VNShop
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

### 1.5 Create RED Metrics Dashboard

- [ ] Create directory `infra/grafana/dashboards/`
- [ ] Create file `infra/grafana/dashboards/red-metrics.json`:

```json
{
  "annotations": { "list": [] },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "id": null,
  "links": [],
  "panels": [
    {
      "title": "Request Rate (req/s)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(rate(http_server_requests_seconds_count{job=~\"vnshop.*\"}[5m])) by (job)",
          "legendFormat": "{{job}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "reqps",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 10 }
        },
        "overrides": []
      }
    },
    {
      "title": "Error Rate (5xx %)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(rate(http_server_requests_seconds_count{job=~\"vnshop.*\", status=~\"5..\"}[5m])) by (job) / sum(rate(http_server_requests_seconds_count{job=~\"vnshop.*\"}[5m])) by (job) * 100",
          "legendFormat": "{{job}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 10 },
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 1 },
              { "color": "red", "value": 5 }
            ]
          }
        },
        "overrides": []
      }
    },
    {
      "title": "Duration p50 / p95 / p99 (ms)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "histogram_quantile(0.50, sum(rate(http_server_requests_seconds_bucket{job=~\"vnshop.*\"}[5m])) by (le, job))",
          "legendFormat": "p50 {{job}}",
          "refId": "A"
        },
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{job=~\"vnshop.*\"}[5m])) by (le, job))",
          "legendFormat": "p95 {{job}}",
          "refId": "B"
        },
        {
          "expr": "histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket{job=~\"vnshop.*\"}[5m])) by (le, job))",
          "legendFormat": "p99 {{job}}",
          "refId": "C"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 5 }
        },
        "overrides": []
      }
    },
    {
      "title": "Request Rate by Status Code",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(rate(http_server_requests_seconds_count{job=~\"vnshop.*\"}[5m])) by (status)",
          "legendFormat": "HTTP {{status}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "reqps",
          "custom": { "drawStyle": "bars", "lineWidth": 1, "fillOpacity": 50, "stacking": { "mode": "normal" } }
        },
        "overrides": []
      }
    },
    {
      "title": "Top 10 Slowest Endpoints (p99)",
      "type": "table",
      "gridPos": { "h": 8, "w": 24, "x": 0, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "topk(10, histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket{job=~\"vnshop.*\"}[5m])) by (le, uri, method, job)))",
          "format": "table",
          "instant": true,
          "refId": "A"
        }
      ],
      "transformations": [
        { "id": "organize", "options": { "excludeByName": { "Time": true, "le": true }, "renameByName": { "Value": "p99 (s)", "job": "Service", "uri": "URI", "method": "Method" } } }
      ]
    }
  ],
  "schemaVersion": 39,
  "tags": ["vnshop", "red"],
  "templating": {
    "list": [
      {
        "current": { "selected": false, "text": "Prometheus", "value": "Prometheus" },
        "hide": 0,
        "includeAll": false,
        "name": "datasource",
        "options": [],
        "query": "prometheus",
        "refresh": 1,
        "type": "datasource"
      }
    ]
  },
  "time": { "from": "now-1h", "to": "now" },
  "title": "VNShop - RED Metrics",
  "uid": "vnshop-red-metrics"
}
```

### 1.6 Create JVM Overview Dashboard

- [ ] Create file `infra/grafana/dashboards/jvm-overview.json`:

```json
{
  "annotations": { "list": [] },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "id": null,
  "links": [],
  "panels": [
    {
      "title": "JVM Heap Used",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "jvm_memory_used_bytes{job=~\"vnshop.*\", area=\"heap\"} / 1024 / 1024",
          "legendFormat": "{{job}} - {{id}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "decmbytes",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 10 }
        },
        "overrides": []
      }
    },
    {
      "title": "JVM Heap Max",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "jvm_memory_max_bytes{job=~\"vnshop.*\", area=\"heap\"} / 1024 / 1024",
          "legendFormat": "{{job}} - {{id}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "decmbytes",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 5, "lineStyle": { "dash": [10, 10], "fill": "dash" } }
        },
        "overrides": []
      }
    },
    {
      "title": "GC Pause Duration (avg)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "rate(jvm_gc_pause_seconds_sum{job=~\"vnshop.*\"}[5m]) / rate(jvm_gc_pause_seconds_count{job=~\"vnshop.*\"}[5m])",
          "legendFormat": "{{job}} - {{cause}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 10 }
        },
        "overrides": []
      }
    },
    {
      "title": "JVM Threads",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "jvm_threads_live_threads{job=~\"vnshop.*\"}",
          "legendFormat": "{{job}} live",
          "refId": "A"
        },
        {
          "expr": "jvm_threads_peak_threads{job=~\"vnshop.*\"}",
          "legendFormat": "{{job}} peak",
          "refId": "B"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 5 }
        },
        "overrides": []
      }
    },
    {
      "title": "HikariCP Active Connections",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "hikaricp_connections_active{job=~\"vnshop.*\"}",
          "legendFormat": "{{job}} active",
          "refId": "A"
        },
        {
          "expr": "hikaricp_connections_max{job=~\"vnshop.*\"}",
          "legendFormat": "{{job}} max",
          "refId": "B"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 10 }
        },
        "overrides": []
      }
    },
    {
      "title": "CPU Usage",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "process_cpu_usage{job=~\"vnshop.*\"}",
          "legendFormat": "{{job}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percentunit",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 10 }
        },
        "overrides": []
      }
    }
  ],
  "schemaVersion": 39,
  "tags": ["vnshop", "jvm"],
  "templating": {
    "list": [
      {
        "current": { "selected": false, "text": "Prometheus", "value": "Prometheus" },
        "hide": 0,
        "includeAll": false,
        "name": "datasource",
        "options": [],
        "query": "prometheus",
        "refresh": 1,
        "type": "datasource"
      }
    ]
  },
  "time": { "from": "now-1h", "to": "now" },
  "title": "VNShop - JVM Overview",
  "uid": "vnshop-jvm-overview"
}
```

### 1.7 Create Kafka Consumer Lag Dashboard

- [ ] Create file `infra/grafana/dashboards/kafka-consumer-lag.json`:

```json
{
  "annotations": { "list": [] },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "id": null,
  "links": [],
  "panels": [
    {
      "title": "Consumer Lag by Group",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 24, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "kafka_consumer_fetch_manager_records_lag_max{job=~\"vnshop.*\"}",
          "legendFormat": "{{job}} - {{topic}} ({{partition}})",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 15 },
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 100 },
              { "color": "red", "value": 1000 }
            ]
          }
        },
        "overrides": []
      }
    },
    {
      "title": "Consumer Records Rate",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "rate(kafka_consumer_fetch_manager_records_consumed_total{job=~\"vnshop.*\"}[5m])",
          "legendFormat": "{{job}} - {{topic}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ops",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 10 }
        },
        "overrides": []
      }
    },
    {
      "title": "Consumer Fetch Latency (avg ms)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "kafka_consumer_fetch_manager_fetch_latency_avg{job=~\"vnshop.*\"}",
          "legendFormat": "{{job}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ms",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 10 }
        },
        "overrides": []
      }
    },
    {
      "title": "Lag Trend (per service)",
      "type": "stat",
      "gridPos": { "h": 6, "w": 24, "x": 0, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(kafka_consumer_fetch_manager_records_lag_max{job=~\"vnshop.*\"}) by (job)",
          "legendFormat": "{{job}}",
          "refId": "A"
        }
      ],
      "options": {
        "reduceOptions": { "calcs": ["lastNotNull"] },
        "colorMode": "background",
        "graphMode": "area",
        "textMode": "auto"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 100 },
              { "color": "red", "value": 1000 }
            ]
          }
        },
        "overrides": []
      }
    }
  ],
  "schemaVersion": 39,
  "tags": ["vnshop", "kafka"],
  "templating": {
    "list": [
      {
        "current": { "selected": false, "text": "Prometheus", "value": "Prometheus" },
        "hide": 0,
        "includeAll": false,
        "name": "datasource",
        "options": [],
        "query": "prometheus",
        "refresh": 1,
        "type": "datasource"
      }
    ]
  },
  "time": { "from": "now-1h", "to": "now" },
  "title": "VNShop - Kafka Consumer Lag",
  "uid": "vnshop-kafka-lag"
}
```

### 1.8 Create Business KPIs Dashboard

- [ ] Create file `infra/grafana/dashboards/business-kpis.json`:

```json
{
  "annotations": { "list": [] },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "id": null,
  "links": [],
  "panels": [
    {
      "title": "Orders Created (rate)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 8, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(rate(vnshop_orders_created_total[5m]))",
          "legendFormat": "Orders/s",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ops",
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 20 },
          "color": { "mode": "fixed", "fixedColor": "blue" }
        },
        "overrides": []
      }
    },
    {
      "title": "Orders Cancelled (rate)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 8, "x": 8, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(rate(vnshop_orders_cancelled_total[5m]))",
          "legendFormat": "Cancellations/s",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ops",
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 20 },
          "color": { "mode": "fixed", "fixedColor": "orange" }
        },
        "overrides": []
      }
    },
    {
      "title": "Order Creation Failures (rate)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 8, "x": 16, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(rate(vnshop_orders_creation_failed_total[5m]))",
          "legendFormat": "Failures/s",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ops",
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 20 },
          "color": { "mode": "fixed", "fixedColor": "red" }
        },
        "overrides": []
      }
    },
    {
      "title": "Payment Success vs Failure",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(rate(vnshop_payment_successes_total[5m]))",
          "legendFormat": "Successes/s",
          "refId": "A"
        },
        {
          "expr": "sum(rate(vnshop_payment_failures_total[5m]))",
          "legendFormat": "Failures/s",
          "refId": "B"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ops",
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 15 }
        },
        "overrides": [
          { "matcher": { "id": "byName", "options": "Successes/s" }, "properties": [{ "id": "color", "value": { "mode": "fixed", "fixedColor": "green" } }] },
          { "matcher": { "id": "byName", "options": "Failures/s" }, "properties": [{ "id": "color", "value": { "mode": "fixed", "fixedColor": "red" } }] }
        ]
      }
    },
    {
      "title": "Payment Failure Rate (%)",
      "type": "gauge",
      "gridPos": { "h": 8, "w": 6, "x": 12, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(rate(vnshop_payment_failures_total[10m])) / sum(rate(vnshop_payment_attempts_total[10m])) * 100",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "min": 0,
          "max": 100,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 1 },
              { "color": "red", "value": 2 }
            ]
          }
        },
        "overrides": []
      }
    },
    {
      "title": "Refunds (rate)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 6, "x": 18, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(rate(vnshop_payment_refunds_total[5m]))",
          "legendFormat": "Refunds/s",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ops",
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 20 },
          "color": { "mode": "fixed", "fixedColor": "purple" }
        },
        "overrides": []
      }
    },
    {
      "title": "Order Creation Duration (p50/p95/p99)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "histogram_quantile(0.50, sum(rate(vnshop_order_creation_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p50",
          "refId": "A"
        },
        {
          "expr": "histogram_quantile(0.95, sum(rate(vnshop_order_creation_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p95",
          "refId": "B"
        },
        {
          "expr": "histogram_quantile(0.99, sum(rate(vnshop_order_creation_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p99",
          "refId": "C"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 10 }
        },
        "overrides": []
      }
    },
    {
      "title": "Total Orders Today",
      "type": "stat",
      "gridPos": { "h": 8, "w": 6, "x": 12, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(increase(vnshop_orders_created_total[24h]))",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "options": {
        "reduceOptions": { "calcs": ["lastNotNull"] },
        "colorMode": "value",
        "graphMode": "area",
        "textMode": "auto"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "color": { "mode": "thresholds" },
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "blue", "value": null }
            ]
          }
        },
        "overrides": []
      }
    },
    {
      "title": "Total Payments Today",
      "type": "stat",
      "gridPos": { "h": 8, "w": 6, "x": 18, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "sum(increase(vnshop_payment_attempts_total[24h]))",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "options": {
        "reduceOptions": { "calcs": ["lastNotNull"] },
        "colorMode": "value",
        "graphMode": "area",
        "textMode": "auto"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "color": { "mode": "thresholds" },
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null }
            ]
          }
        },
        "overrides": []
      }
    }
  ],
  "schemaVersion": 39,
  "tags": ["vnshop", "business"],
  "templating": {
    "list": [
      {
        "current": { "selected": false, "text": "Prometheus", "value": "Prometheus" },
        "hide": 0,
        "includeAll": false,
        "name": "datasource",
        "options": [],
        "query": "prometheus",
        "refresh": 1,
        "type": "datasource"
      }
    ]
  },
  "time": { "from": "now-6h", "to": "now" },
  "title": "VNShop - Business KPIs",
  "uid": "vnshop-business-kpis"
}
```

### 1.9 Create K8s manifests for Grafana

- [ ] Create directory `infra/k8s/base/services/grafana/`
- [ ] Create file `infra/k8s/base/services/grafana/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  labels:
    app: grafana
    component: observability
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
        component: observability
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:11.1.0
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: GF_SECURITY_ADMIN_USER
              value: admin
            - name: GF_SECURITY_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: grafana-secret
                  key: admin-password
            - name: GF_USERS_ALLOW_SIGN_UP
              value: "false"
          volumeMounts:
            - name: provisioning-datasources
              mountPath: /etc/grafana/provisioning/datasources
            - name: provisioning-dashboards
              mountPath: /etc/grafana/provisioning/dashboards
            - name: dashboards
              mountPath: /var/lib/grafana/dashboards
            - name: grafana-storage
              mountPath: /var/lib/grafana
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 30
      volumes:
        - name: provisioning-datasources
          configMap:
            name: grafana-datasources
        - name: provisioning-dashboards
          configMap:
            name: grafana-dashboard-provider
        - name: dashboards
          configMap:
            name: grafana-dashboards
        - name: grafana-storage
          persistentVolumeClaim:
            claimName: grafana-pvc
```

- [ ] Create file `infra/k8s/base/services/grafana/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: grafana
  labels:
    app: grafana
    component: observability
spec:
  type: ClusterIP
  ports:
    - port: 3000
      targetPort: 3000
      protocol: TCP
      name: http
  selector:
    app: grafana
```

- [ ] Create file `infra/k8s/base/services/grafana/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
```

### 1.10 Verify Task 1

- [ ] Run verification commands:

```powershell
# Validate docker-compose syntax
docker compose config --quiet

# Verify Prometheus container starts and config loads
docker compose up -d prometheus
# Wait for healthy
docker compose ps prometheus
# Check targets page
curl http://localhost:9090/-/healthy

# Verify Grafana container starts
docker compose up -d grafana
docker compose ps grafana
# Check Grafana health
curl http://localhost:3001/api/health

# Verify datasources provisioned
curl -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" http://localhost:3001/api/datasources | jq '.[].name'

# Verify dashboards provisioned
curl -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" http://localhost:3001/api/search?type=dash-db | jq '.[].title'

# Tear down
docker compose down prometheus grafana
```

### 1.11 Commit

- [ ] Stage and commit:

```powershell
git add infra/grafana/ infra/k8s/base/services/grafana/ docker-compose.yml infra/prometheus/prometheus.yml
git commit -m "feat(observability): add Prometheus + Grafana containers with 4 auto-provisioned dashboards

- Add Prometheus container (previously only config existed, no container)
- Add Grafana 11.1.0 with auto-provisioned Prometheus + Loki + Jaeger datasources
- Create 4 dashboards: RED metrics, JVM overview, Kafka consumer lag, Business KPIs
- Add K8s manifests for Grafana deployment
- Prometheus scrapes existing 11 service actuator endpoints
- Grafana exposed on port 3001 (avoids conflict with Grafana container port 3000)"
```

---

## Task 2 (A2): Loki + Promtail for Centralized Logging

### 2.1 Create Loki configuration

- [ ] Create directory `infra/loki/`
- [ ] Create file `infra/loki/loki-config.yml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096
  log_level: info

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: "2024-01-01"
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

storage_config:
  filesystem:
    directory: /loki/chunks

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  max_query_series: 5000
  max_query_parallelism: 2
  ingestion_rate_mb: 10
  ingestion_burst_size_mb: 20

compactor:
  working_directory: /loki/compactor
  compaction_interval: 10m
  retention_enabled: true
  retention_delete_delay: 2h
  delete_request_store: filesystem

table_manager:
  retention_deletes_enabled: true
  retention_period: 168h

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

analytics:
  reporting_enabled: false
```

### 2.2 Create Promtail configuration

- [ ] Create directory `infra/promtail/`
- [ ] Create file `infra/promtail/promtail-config.yml`:

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0
  log_level: info

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push
    batchwait: 1s
    batchsize: 1048576
    timeout: 10s

scrape_configs:
  - job_name: docker
    static_configs:
      - targets:
          - localhost
        labels:
          job: docker
          __path__: /var/lib/docker/containers/*/*-json.log

    pipeline_stages:
      # Parse Docker JSON log format
      - docker: {}

      # Try to parse the log line as JSON (Spring Boot structured logging)
      - json:
          expressions:
            level: level
            logger: logger_name
            message: message
            traceId: traceId
            spanId: spanId
            service: service_name
            timestamp: "@timestamp"

      # Extract service_name from container label
      - labels:
          level:
          service:
          traceId:

      # Fallback: extract level from plain text logs
      - regex:
          expression: '(?P<level>(INFO|WARN|ERROR|DEBUG|TRACE))'
      - labels:
          level:

      # Extract container name from Docker JSON log filename path
      - regex:
          source: filename
          expression: '/var/lib/docker/containers/(?P<container_id>[a-f0-9]+)/.*'
      - labels:
          container_id:

      # Map container names to service names using Docker labels
      - docker:
          {}

      # Normalize level to lowercase
      - template:
          source: level
          template: '{{ ToLower .Value }}'
      - labels:
          level:

      # Drop healthcheck noise
      - match:
          selector: '{job="docker"}'
          stages:
            - regex:
                expression: '.*(GET /actuator/health|GET /health|healthcheck).*'
            - drop:
                source: ""
                expression: '.*(GET /actuator/health|GET /health|healthcheck).*'
```

### 2.3 Add Loki container to docker-compose.yml

- [ ] Add `loki` service definition to `docker-compose.yml` (insert AFTER `grafana`):

```yaml
  loki:
    image: grafana/loki:3.1.0
    container_name: vnshop-loki
    ports:
      - "3100:3100"
    volumes:
      - ./infra/loki/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3100/ready || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10
```

- [ ] Add `loki-data` to the `volumes:` section at the bottom of docker-compose.yml:

```yaml
  loki-data:
```

### 2.4 Add Promtail container to docker-compose.yml

- [ ] Add `promtail` service definition to `docker-compose.yml` (insert AFTER `loki`):

```yaml
  promtail:
    image: grafana/promtail:3.1.0
    container_name: vnshop-promtail
    volumes:
      - ./infra/promtail/promtail-config.yml:/etc/promtail/config.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: -config.file=/etc/promtail/config.yml
    depends_on:
      loki:
        condition: service_healthy
```

### 2.5 Update Grafana depends_on to include Loki

- [ ] In the existing `grafana` service definition (added in Task 1), update `depends_on` to also wait for Loki:

```yaml
    depends_on:
      prometheus:
        condition: service_healthy
      loki:
        condition: service_healthy
```

### 2.6 Create K8s manifests for Loki

- [ ] Create directory `infra/k8s/base/services/loki/`
- [ ] Create file `infra/k8s/base/services/loki/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
  labels:
    app: loki
    component: observability
spec:
  replicas: 1
  selector:
    matchLabels:
      app: loki
  template:
    metadata:
      labels:
        app: loki
        component: observability
    spec:
      containers:
        - name: loki
          image: grafana/loki:3.1.0
          args:
            - -config.file=/etc/loki/local-config.yaml
          ports:
            - containerPort: 3100
              name: http
            - containerPort: 9096
              name: grpc
          volumeMounts:
            - name: loki-config
              mountPath: /etc/loki
            - name: loki-storage
              mountPath: /loki
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 1Gi
          readinessProbe:
            httpGet:
              path: /ready
              port: 3100
            initialDelaySeconds: 15
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /ready
              port: 3100
            initialDelaySeconds: 30
            periodSeconds: 30
      volumes:
        - name: loki-config
          configMap:
            name: loki-config
        - name: loki-storage
          persistentVolumeClaim:
            claimName: loki-pvc
```

- [ ] Create file `infra/k8s/base/services/loki/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: loki
  labels:
    app: loki
    component: observability
spec:
  type: ClusterIP
  ports:
    - port: 3100
      targetPort: 3100
      protocol: TCP
      name: http
    - port: 9096
      targetPort: 9096
      protocol: TCP
      name: grpc
  selector:
    app: loki
```

- [ ] Create file `infra/k8s/base/services/loki/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
```

### 2.7 Verify Task 2

- [ ] Run verification commands:

```powershell
# Validate docker-compose syntax
docker compose config --quiet

# Start the logging stack
docker compose up -d loki promtail

# Wait for Loki healthy
docker compose ps loki
curl http://localhost:3100/ready

# Verify Promtail is running and connected
docker compose logs promtail --tail=20

# Start a test service and verify logs flow to Loki
docker compose --profile apps up -d api-gateway
Start-Sleep -Seconds 30

# Query Loki for any ingested logs
curl "http://localhost:3100/loki/api/v1/query?query={job=%22docker%22}&limit=5"

# Verify Grafana can query Loki datasource
curl -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" "http://localhost:3001/api/datasources/proxy/uid/loki/loki/api/v1/labels"

# Tear down
docker compose --profile apps down
docker compose down loki promtail
```

### 2.8 Commit

- [ ] Stage and commit:

```powershell
git add infra/loki/ infra/promtail/ infra/k8s/base/services/loki/ docker-compose.yml
git commit -m "feat(observability): add Loki + Promtail for centralized log aggregation

- Add Loki 3.1.0 with single-tenant mode, filesystem storage, 7-day retention
- Add Promtail scraping Docker container logs via /var/lib/docker/containers
- Promtail pipeline: parse Docker JSON, extract level/traceId/service_name
- Health-check noise (actuator/health) filtered out by Promtail drop stage
- Grafana Loki datasource auto-provisioned with traceId -> Jaeger linking
- Add K8s manifests for Loki deployment"
```

---

## Task 3 (A3): SLI/SLO Definitions

### 3.1 Create SLI/SLO Documentation

- [ ] Create file `docs/sli-slo.md`:

```markdown
# VNShop SLI/SLO Definitions

## Overview

This document defines the Service Level Indicators (SLIs) and Service Level Objectives (SLOs) for VNShop.
All SLOs have a **2-week baseline-only period** before alerting is enabled. During baseline, recording
rules populate metrics but burn-rate alerts are silenced.

## SLO Summary

| SLO | Target | Window | Burn Rate Alert |
|-----|--------|--------|-----------------|
| Availability | 99.5% | 30d rolling | 14.4x (2min), 6x (15min), 3x (1h), 1x (6h) |
| Read Latency (p99) | < 500ms | 30d rolling | Same multi-window |
| Write Latency (p99) | < 2000ms | 30d rolling | Same multi-window |

## Error Budget

With a 30-day window and 99.5% availability SLO:
- **Total budget**: 30d * 24h * 60m * 0.5% = **216 minutes** of downtime per 30-day window
- **Daily budget**: ~7.2 minutes/day

## SLI Definitions

### 1. Availability SLI

**Definition**: Ratio of successful HTTP responses (non-5xx) to total HTTP responses across all services.

```promql
sum(rate(http_server_requests_seconds_count{job=~"vnshop.*", status!~"5.."}[5m]))
/
sum(rate(http_server_requests_seconds_count{job=~"vnshop.*"}[5m]))
```

**Exclusions**:
- Health check endpoints (`/actuator/health`, `/actuator/prometheus`)
- Expected client errors (4xx) do NOT count against availability

### 2. Read Latency SLI

**Definition**: 99th percentile latency for read operations (GET requests) across all services.

```promql
histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket{job=~"vnshop.*", method="GET"}[5m])) by (le))
```

**Target**: p99 < 500ms

### 3. Write Latency SLI

**Definition**: 99th percentile latency for write operations (POST/PUT/PATCH/DELETE) across all services.

```promql
histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket{job=~"vnshop.*", method=~"POST|PUT|PATCH|DELETE"}[5m])) by (le))
```

**Target**: p99 < 2000ms

## Burn Rate Alerting

Multi-window, multi-burn-rate approach (Google SRE Workbook):

| Severity | Burn Rate | Short Window | Long Window | Budget Consumed |
|----------|-----------|--------------|-------------|-----------------|
| Page (critical) | 14.4x | 2m | 5m | 2% in 1h |
| Page (critical) | 6x | 15m | 1h | 5% in 6h |
| Ticket (warning) | 3x | 1h | 3h | 10% in 1d |
| Ticket (warning) | 1x | 6h | 24h | 10% in 3d |

## Baseline Period

- **Duration**: 2 weeks from initial deployment
- **Behavior**: Recording rules active, burn-rate alerts have `for: 336h` (14 days) — effectively silenced
- **Action**: After 2 weeks, review actual error rates and latency percentiles, then update
  alert `for` durations to operational values (2m/15m/1h/6h as defined above)

## Measurement Points

| Service | Metrics Source | Port |
|---------|---------------|------|
| api-gateway | /actuator/prometheus | 8080 |
| user-service | /actuator/prometheus | 8081 |
| product-service | /actuator/prometheus | 8082 |
| inventory-service | /actuator/prometheus | 8083 |
| search-service | /actuator/prometheus | 8086 |
| order-service | /actuator/prometheus | 8091 |
| payment-service | /actuator/prometheus | 8092 |
| shipping-service | /actuator/prometheus | 8093 |
| coupon-service | /actuator/prometheus | 8088 |
| seller-finance-service | /actuator/prometheus | 8090 |
| recommendations-service | /actuator/prometheus | 8094 |

## Dashboard

The SLO Overview dashboard in Grafana (`vnshop-slo-overview`) visualizes:
- Current availability vs target (gauge)
- Error budget remaining (time series)
- Burn rate (current vs thresholds)
- Read/Write latency p99 vs targets
```

### 3.2 Create SLO Recording Rules

- [ ] Create file `infra/prometheus/slo-rules.yml`:

```yaml
groups:
  - name: vnshop-slo-recording
    interval: 30s
    rules:
      # Availability SLI - ratio of non-5xx to total requests
      - record: vnshop:sli:availability:rate5m
        expr: >
          sum(rate(http_server_requests_seconds_count{job=~"vnshop.*", status!~"5.."}[5m]))
          /
          sum(rate(http_server_requests_seconds_count{job=~"vnshop.*"}[5m]))

      - record: vnshop:sli:availability:rate30m
        expr: >
          sum(rate(http_server_requests_seconds_count{job=~"vnshop.*", status!~"5.."}[30m]))
          /
          sum(rate(http_server_requests_seconds_count{job=~"vnshop.*"}[30m]))

      - record: vnshop:sli:availability:rate1h
        expr: >
          sum(rate(http_server_requests_seconds_count{job=~"vnshop.*", status!~"5.."}[1h]))
          /
          sum(rate(http_server_requests_seconds_count{job=~"vnshop.*"}[1h]))

      - record: vnshop:sli:availability:rate6h
        expr: >
          sum(rate(http_server_requests_seconds_count{job=~"vnshop.*", status!~"5.."}[6h]))
          /
          sum(rate(http_server_requests_seconds_count{job=~"vnshop.*"}[6h]))

      - record: vnshop:sli:availability:rate24h
        expr: >
          sum(rate(http_server_requests_seconds_count{job=~"vnshop.*", status!~"5.."}[24h]))
          /
          sum(rate(http_server_requests_seconds_count{job=~"vnshop.*"}[24h]))

      # Error rate (inverse of availability, for burn-rate calculation)
      - record: vnshop:sli:error_rate:rate5m
        expr: >
          1 - vnshop:sli:availability:rate5m

      - record: vnshop:sli:error_rate:rate30m
        expr: >
          1 - vnshop:sli:availability:rate30m

      - record: vnshop:sli:error_rate:rate1h
        expr: >
          1 - vnshop:sli:availability:rate1h

      - record: vnshop:sli:error_rate:rate6h
        expr: >
          1 - vnshop:sli:availability:rate6h

      - record: vnshop:sli:error_rate:rate24h
        expr: >
          1 - vnshop:sli:availability:rate24h

      # Read latency SLI (p99, GET only)
      - record: vnshop:sli:read_latency_p99:rate5m
        expr: >
          histogram_quantile(0.99,
            sum(rate(http_server_requests_seconds_bucket{job=~"vnshop.*", method="GET"}[5m])) by (le)
          )

      # Write latency SLI (p99, non-GET)
      - record: vnshop:sli:write_latency_p99:rate5m
        expr: >
          histogram_quantile(0.99,
            sum(rate(http_server_requests_seconds_bucket{job=~"vnshop.*", method=~"POST|PUT|PATCH|DELETE"}[5m])) by (le)
          )

      # Error budget remaining (30-day window, 99.5% target)
      # Budget = 1 - (error_rate_30d / (1 - 0.995))
      - record: vnshop:slo:error_budget_remaining
        expr: >
          1 - (
            (1 - vnshop:sli:availability:rate24h)
            /
            (1 - 0.995)
          )

  - name: vnshop-slo-burn-rate-alerts
    rules:
      # === AVAILABILITY BURN RATE ALERTS ===
      # SLO target: 99.5% (error budget = 0.5% = 0.005)

      # Critical: 14.4x burn rate (2% of 30d budget consumed in 1 hour)
      # Short window: 5m, Long window: N/A (use 5m only for fast detection)
      - alert: VNShopSLOAvailabilityBurnRateCriticalFast
        expr: >
          vnshop:sli:error_rate:rate5m > (14.4 * 0.005)
        for: 2m
        labels:
          severity: critical
          slo: availability
          window: fast
        annotations:
          summary: "VNShop availability SLO burn rate critical (14.4x)"
          description: "Error rate {{ $value | humanizePercentage }} is burning 14.4x the error budget. At this rate, the 30-day budget will be exhausted in ~50 hours."
          runbook_url: "https://wiki.vnshop.vn/runbooks/slo-availability-burn-rate"

      # Critical: 6x burn rate (5% of 30d budget consumed in 6 hours)
      # Short window: 30m, Long window: 1h
      - alert: VNShopSLOAvailabilityBurnRateCriticalSlow
        expr: >
          vnshop:sli:error_rate:rate30m > (6 * 0.005)
          and
          vnshop:sli:error_rate:rate1h > (6 * 0.005)
        for: 15m
        labels:
          severity: critical
          slo: availability
          window: slow
        annotations:
          summary: "VNShop availability SLO burn rate critical (6x)"
          description: "Error rate is sustained at 6x burn rate across 30m and 1h windows. Budget will exhaust in ~5 days."
          runbook_url: "https://wiki.vnshop.vn/runbooks/slo-availability-burn-rate"

      # Warning: 3x burn rate (10% of 30d budget consumed in 1 day)
      # Short window: 1h, Long window: 6h
      - alert: VNShopSLOAvailabilityBurnRateWarning
        expr: >
          vnshop:sli:error_rate:rate1h > (3 * 0.005)
          and
          vnshop:sli:error_rate:rate6h > (3 * 0.005)
        for: 1h
        labels:
          severity: warning
          slo: availability
          window: medium
        annotations:
          summary: "VNShop availability SLO burn rate elevated (3x)"
          description: "Error rate is sustained at 3x burn rate. Budget will exhaust in ~10 days."

      # Warning: 1x burn rate (sustained degradation over 3 days)
      # Short window: 6h, Long window: 24h
      - alert: VNShopSLOAvailabilityBurnRateLow
        expr: >
          vnshop:sli:error_rate:rate6h > (1 * 0.005)
          and
          vnshop:sli:error_rate:rate24h > (1 * 0.005)
        for: 6h
        labels:
          severity: warning
          slo: availability
          window: long
        annotations:
          summary: "VNShop availability SLO burn rate at budget pace (1x)"
          description: "Error rate at or above budget consumption pace for 6h+. Investigate trending degradation."

      # === LATENCY BURN RATE ALERTS ===

      # Read latency SLO violation (p99 > 500ms sustained)
      - alert: VNShopSLOReadLatencyBreach
        expr: >
          vnshop:sli:read_latency_p99:rate5m > 0.5
        for: 5m
        labels:
          severity: warning
          slo: read_latency
        annotations:
          summary: "VNShop read latency p99 exceeds 500ms SLO"
          description: "Read latency p99 is {{ $value | humanizeDuration }} (target: 500ms)."

      # Write latency SLO violation (p99 > 2s sustained)
      - alert: VNShopSLOWriteLatencyBreach
        expr: >
          vnshop:sli:write_latency_p99:rate5m > 2.0
        for: 5m
        labels:
          severity: warning
          slo: write_latency
        annotations:
          summary: "VNShop write latency p99 exceeds 2s SLO"
          description: "Write latency p99 is {{ $value | humanizeDuration }} (target: 2000ms)."

      # Error budget exhaustion alert
      - alert: VNShopSLOErrorBudgetExhausted
        expr: >
          vnshop:slo:error_budget_remaining < 0
        for: 5m
        labels:
          severity: critical
          slo: error_budget
        annotations:
          summary: "VNShop error budget exhausted"
          description: "The 30-day error budget is fully consumed. Error budget remaining: {{ $value | humanizePercentage }}."

      # Error budget low warning (< 25% remaining)
      - alert: VNShopSLOErrorBudgetLow
        expr: >
          vnshop:slo:error_budget_remaining < 0.25
          and
          vnshop:slo:error_budget_remaining >= 0
        for: 15m
        labels:
          severity: warning
          slo: error_budget
        annotations:
          summary: "VNShop error budget running low"
          description: "Only {{ $value | humanizePercentage }} of the 30-day error budget remains."
```

### 3.3 Create SLO Grafana Dashboard

- [ ] Create file `infra/grafana/dashboards/slo-overview.json`:

```json
{
  "annotations": { "list": [] },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "id": null,
  "links": [],
  "panels": [
    {
      "title": "Availability (current vs 99.5% target)",
      "type": "gauge",
      "gridPos": { "h": 8, "w": 8, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "vnshop:sli:availability:rate5m * 100",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "min": 95,
          "max": 100,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "red", "value": null },
              { "color": "orange", "value": 99 },
              { "color": "yellow", "value": 99.5 },
              { "color": "green", "value": 99.9 }
            ]
          }
        },
        "overrides": []
      },
      "options": {
        "showThresholdLabels": true,
        "showThresholdMarkers": true
      }
    },
    {
      "title": "Error Budget Remaining",
      "type": "gauge",
      "gridPos": { "h": 8, "w": 8, "x": 8, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "vnshop:slo:error_budget_remaining * 100",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "min": 0,
          "max": 100,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "red", "value": null },
              { "color": "orange", "value": 10 },
              { "color": "yellow", "value": 25 },
              { "color": "green", "value": 50 }
            ]
          }
        },
        "overrides": []
      },
      "options": {
        "showThresholdLabels": true,
        "showThresholdMarkers": true
      }
    },
    {
      "title": "SLO Status",
      "type": "stat",
      "gridPos": { "h": 8, "w": 8, "x": 16, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "vnshop:sli:availability:rate5m >= 0.995",
          "legendFormat": "Availability",
          "refId": "A"
        },
        {
          "expr": "vnshop:sli:read_latency_p99:rate5m <= 0.5",
          "legendFormat": "Read Latency",
          "refId": "B"
        },
        {
          "expr": "vnshop:sli:write_latency_p99:rate5m <= 2.0",
          "legendFormat": "Write Latency",
          "refId": "C"
        }
      ],
      "options": {
        "reduceOptions": { "calcs": ["lastNotNull"] },
        "colorMode": "background",
        "graphMode": "none",
        "textMode": "name"
      },
      "fieldConfig": {
        "defaults": {
          "mappings": [
            { "type": "value", "options": { "0": { "text": "BREACHED", "color": "red" }, "1": { "text": "OK", "color": "green" } } }
          ]
        },
        "overrides": []
      }
    },
    {
      "title": "Availability Over Time",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 24, "x": 0, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "vnshop:sli:availability:rate5m * 100",
          "legendFormat": "Availability (5m)",
          "refId": "A"
        },
        {
          "expr": "vnshop:sli:availability:rate1h * 100",
          "legendFormat": "Availability (1h)",
          "refId": "B"
        },
        {
          "expr": "99.5",
          "legendFormat": "SLO Target (99.5%)",
          "refId": "C"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "min": 95,
          "max": 100,
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 5 }
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "SLO Target (99.5%)" },
            "properties": [
              { "id": "custom.lineStyle", "value": { "dash": [10, 10], "fill": "dash" } },
              { "id": "color", "value": { "mode": "fixed", "fixedColor": "red" } },
              { "id": "custom.fillOpacity", "value": 0 }
            ]
          }
        ]
      }
    },
    {
      "title": "Error Budget Burn Rate",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "vnshop:sli:error_rate:rate5m / 0.005",
          "legendFormat": "Burn Rate (5m window)",
          "refId": "A"
        },
        {
          "expr": "vnshop:sli:error_rate:rate1h / 0.005",
          "legendFormat": "Burn Rate (1h window)",
          "refId": "B"
        },
        {
          "expr": "1",
          "legendFormat": "1x (budget pace)",
          "refId": "C"
        },
        {
          "expr": "6",
          "legendFormat": "6x (critical threshold)",
          "refId": "D"
        },
        {
          "expr": "14.4",
          "legendFormat": "14.4x (page threshold)",
          "refId": "E"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "short",
          "custom": { "drawStyle": "line", "lineWidth": 1, "fillOpacity": 5 }
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "1x (budget pace)" },
            "properties": [
              { "id": "custom.lineStyle", "value": { "dash": [10, 10], "fill": "dash" } },
              { "id": "color", "value": { "mode": "fixed", "fixedColor": "yellow" } },
              { "id": "custom.fillOpacity", "value": 0 }
            ]
          },
          {
            "matcher": { "id": "byName", "options": "6x (critical threshold)" },
            "properties": [
              { "id": "custom.lineStyle", "value": { "dash": [10, 10], "fill": "dash" } },
              { "id": "color", "value": { "mode": "fixed", "fixedColor": "orange" } },
              { "id": "custom.fillOpacity", "value": 0 }
            ]
          },
          {
            "matcher": { "id": "byName", "options": "14.4x (page threshold)" },
            "properties": [
              { "id": "custom.lineStyle", "value": { "dash": [10, 10], "fill": "dash" } },
              { "id": "color", "value": { "mode": "fixed", "fixedColor": "red" } },
              { "id": "custom.fillOpacity", "value": 0 }
            ]
          }
        ]
      }
    },
    {
      "title": "Read Latency p99 vs SLO",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "vnshop:sli:read_latency_p99:rate5m * 1000",
          "legendFormat": "Read p99",
          "refId": "A"
        },
        {
          "expr": "500",
          "legendFormat": "SLO Target (500ms)",
          "refId": "B"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ms",
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 10 }
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "SLO Target (500ms)" },
            "properties": [
              { "id": "custom.lineStyle", "value": { "dash": [10, 10], "fill": "dash" } },
              { "id": "color", "value": { "mode": "fixed", "fixedColor": "red" } },
              { "id": "custom.fillOpacity", "value": 0 }
            ]
          }
        ]
      }
    },
    {
      "title": "Write Latency p99 vs SLO",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 24 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "vnshop:sli:write_latency_p99:rate5m * 1000",
          "legendFormat": "Write p99",
          "refId": "A"
        },
        {
          "expr": "2000",
          "legendFormat": "SLO Target (2000ms)",
          "refId": "B"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ms",
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 10 }
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "SLO Target (2000ms)" },
            "properties": [
              { "id": "custom.lineStyle", "value": { "dash": [10, 10], "fill": "dash" } },
              { "id": "color", "value": { "mode": "fixed", "fixedColor": "red" } },
              { "id": "custom.fillOpacity", "value": 0 }
            ]
          }
        ]
      }
    },
    {
      "title": "Error Budget Depletion (30d window)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 24 },
      "datasource": { "type": "prometheus", "uid": "${datasource}" },
      "targets": [
        {
          "expr": "vnshop:slo:error_budget_remaining * 100",
          "legendFormat": "Budget Remaining %",
          "refId": "A"
        },
        {
          "expr": "25",
          "legendFormat": "Warning Threshold (25%)",
          "refId": "B"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "min": 0,
          "max": 100,
          "custom": { "drawStyle": "line", "lineWidth": 2, "fillOpacity": 15 }
        },
        "overrides": [
          {
            "matcher": { "id": "byName", "options": "Warning Threshold (25%)" },
            "properties": [
              { "id": "custom.lineStyle", "value": { "dash": [10, 10], "fill": "dash" } },
              { "id": "color", "value": { "mode": "fixed", "fixedColor": "orange" } },
              { "id": "custom.fillOpacity", "value": 0 }
            ]
          }
        ]
      }
    }
  ],
  "schemaVersion": 39,
  "tags": ["vnshop", "slo"],
  "templating": {
    "list": [
      {
        "current": { "selected": false, "text": "Prometheus", "value": "Prometheus" },
        "hide": 0,
        "includeAll": false,
        "name": "datasource",
        "options": [],
        "query": "prometheus",
        "refresh": 1,
        "type": "datasource"
      }
    ]
  },
  "time": { "from": "now-24h", "to": "now" },
  "title": "VNShop - SLO Overview",
  "uid": "vnshop-slo-overview"
}
```

### 3.4 Verify Task 3

- [ ] Run verification commands:

```powershell
# Validate Prometheus config with new SLO rules
docker compose up -d prometheus
Start-Sleep -Seconds 10

# Check Prometheus loaded the SLO rules
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name == "vnshop-slo-recording") | .rules | length'
# Expected: 11 recording rules

curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name == "vnshop-slo-burn-rate-alerts") | .rules | length'
# Expected: 7 alerting rules

# Verify SLO dashboard loaded in Grafana
docker compose up -d grafana
Start-Sleep -Seconds 10
curl -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" http://localhost:3001/api/dashboards/uid/vnshop-slo-overview | jq '.dashboard.title'
# Expected: "VNShop - SLO Overview"

# Verify all 5 dashboards are provisioned
curl -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" http://localhost:3001/api/search?type=dash-db | jq '.[].title'
# Expected: RED Metrics, JVM Overview, Kafka Consumer Lag, Business KPIs, SLO Overview

# Check SLI/SLO doc exists
Test-Path docs/sli-slo.md
# Expected: True

# Tear down
docker compose down prometheus grafana
```

### 3.5 Commit

- [ ] Stage and commit:

```powershell
git add infra/prometheus/slo-rules.yml infra/grafana/dashboards/slo-overview.json docs/sli-slo.md
git commit -m "feat(observability): add SLI/SLO definitions with burn-rate alerting

- Create docs/sli-slo.md with formal SLI/SLO definitions
- Targets: 99.5% availability, p99 < 500ms reads, p99 < 2s writes
- Add Prometheus recording rules for multi-window availability SLIs
- Add multi-burn-rate alerts (14.4x/6x/3x/1x) per Google SRE Workbook
- Error budget tracking with exhaustion and low-budget alerts
- Add SLO Overview Grafana dashboard with budget visualization
- 2-week baseline period documented before alert activation"
```

---

## Final Verification (All 3 Tasks Together)

- [ ] Run the full observability stack together:

```powershell
# Bring up full observability stack
docker compose up -d prometheus grafana loki promtail

# Wait for all healthy
Start-Sleep -Seconds 30
docker compose ps prometheus grafana loki promtail

# Verify all endpoints respond
curl http://localhost:9090/-/healthy          # Prometheus
curl http://localhost:3001/api/health          # Grafana
curl http://localhost:3100/ready              # Loki

# Verify Grafana has all datasources
curl -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" http://localhost:3001/api/datasources | jq '.[].name'
# Expected: Prometheus, Loki, Jaeger

# Verify all 5 dashboards
curl -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" "http://localhost:3001/api/search?type=dash-db" | jq '.[].title'
# Expected: VNShop - RED Metrics, VNShop - JVM Overview, VNShop - Kafka Consumer Lag, VNShop - Business KPIs, VNShop - SLO Overview

# Verify Prometheus rules
curl http://localhost:9090/api/v1/rules | jq '.data.groups | length'
# Expected: 3 (vnshop-observability, vnshop-slo-recording, vnshop-slo-burn-rate-alerts)

# Tear down
docker compose down
```

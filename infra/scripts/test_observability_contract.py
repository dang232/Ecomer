import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
METRICS = {
    "outbox_oldest_age_seconds",
    "outbox_dead_total",
    "saga_compensating_age_seconds",
    "orders_stuck_compensating",
    "payment_orphan_total",
    "dlt_age_seconds",
    "redis_evictions_total",
    "provider_latency_seconds",
}


def test_named_metrics_are_exported_in_service_sources():
    source = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in (ROOT / "services").glob("**/*")
        if path.is_file() and path.suffix in {".java", ".ts"}
    )
    assert METRICS <= {name for name in METRICS if name in source}


def test_required_alerts_and_dashboard_rows_exist():
    rules = (ROOT / "infra/prometheus/slo-rules.yml").read_text()
    for alert in ("OutboxStale", "SagaCompensationStuck", "DltStale", "RedisEvictions", "ProviderLatencyHigh"):
        assert f"alert: {alert}" in rules
    dashboard = json.loads((ROOT / "infra/grafana/dashboards/saga-outbox-cache.json").read_text())
    titles = {panel["title"] for panel in dashboard["panels"]}
    assert {"RED per route", "Saga / Outbox / DLT", "Cache and provider latency"} <= titles

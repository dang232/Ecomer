from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
JAVA_SERVICES = (
    "api-gateway",
    "user-service",
    "product-service",
    "inventory-service",
    "search-service",
    "order-service",
    "payment-service",
    "shipping-service",
    "seller-finance-service",
    "invoice-service",
    "video-transcoder",
)
AGENT_PATH = "/app/opentelemetry-javaagent.jar"


def test_active_java_services_package_and_launch_the_otel_agent() -> None:
    for service in JAVA_SERVICES:
        pom = (ROOT / "services" / service / "pom.xml").read_text(encoding="utf-8")
        dockerfile = (ROOT / "services" / service / "Dockerfile").read_text(encoding="utf-8")

        assert "opentelemetry.javaagent.version" in pom, service
        assert "copy-opentelemetry-javaagent" in pom, service
        assert "opentelemetry-javaagent.jar" in pom, service
        assert "COPY --from=builder /workspace/target/opentelemetry-javaagent.jar" in dockerfile, service
        assert AGENT_PATH in dockerfile, service
        assert "JAVA_TOOL_OPTIONS" in dockerfile, service
        assert "exec java" in dockerfile, service


def test_java_runtime_contract_does_not_use_the_dev_jdwp_overlay() -> None:
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    dev_compose = (ROOT / "docker-compose.dev.yml").read_text(encoding="utf-8")

    assert "JAVA_TOOL_OPTIONS" not in compose
    assert "JAVA_TOOL_OPTIONS" in dev_compose
    assert "-agentlib:jdwp" in dev_compose

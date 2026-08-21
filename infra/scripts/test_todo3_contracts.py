"""Behavioral contract tests for the production Kafka authority and drill guards."""
from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
import re
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
STATEFULSET = ROOT / "infra/k8s/kafka/kafka-statefulset.yaml"
INVENTORY = ROOT / "infra/kafka/topic-inventory.yaml"
MIGRATION = ROOT / "infra/kafka/migration-contract.yaml"
DRILL = ROOT / "infra/scripts/kafka-failure-drill.py"
BOOTSTRAP = ROOT / "infra/scripts/init-kafka-topics.sh"
VIDEO_CONFIG = ROOT / "services/video-transcoder/src/main/resources/application.yml"
FINANCE_CONFIG = ROOT / "services/seller-finance-service/src/main/resources/application.yml"
WORKLOADS = ROOT / "infra/k8s/base/workloads.yaml"
COMPOSE = ROOT / "docker-compose.yml"
JAVA_KAFKA_CONFIGS = (
    ROOT / "services/order-service/src/main/resources/application.yml",
    ROOT / "services/payment-service/src/main/resources/application.yml",
    ROOT / "services/product-service/src/main/resources/application.yml",
    ROOT / "services/inventory-service/src/main/resources/application.yml",
    ROOT / "services/shipping-service/src/main/resources/application.yml",
    ROOT / "services/invoice-service/src/main/resources/application.yml",
    ROOT / "services/user-service/src/main/resources/application.yml",
    ROOT / "services/search-service/src/main/resources/application.yml",
    ROOT / "services/recommendations-service/src/main/resources/application.yml",
    ROOT / "services/seller-finance-service/src/main/resources/application.yml",
    ROOT / "services/video-transcoder/src/main/resources/application.yml",
)
KAFKAJS_CONFIGS = (
    ROOT / "services/messaging-service/src/main.ts",
    ROOT / "services/messaging-service/src/messaging/application/kafka-message.publisher.ts",
    ROOT / "services/notification-service/src/main.ts",
)


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_secure_authority_has_three_brokers_and_no_plaintext() -> None:
    documents = [doc for doc in yaml.safe_load_all(STATEFULSET.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    kafka = next(doc for doc in documents if doc.get("kind") == "StatefulSet")
    rendered = STATEFULSET.read_text(encoding="utf-8")
    assert kafka["spec"]["replicas"] == 3
    assert "SASL_SSL" in rendered and "CLIENT:SASL_SSL" in rendered
    assert "CONTROLLER:SSL" in rendered and "INTERNAL:SSL" in rendered
    assert "PLAINTEXT" not in rendered
    assert "replication_factor: 1" not in INVENTORY.read_text(encoding="utf-8")


def test_inventory_positive_and_reassignment_is_deterministic(tmp_path: Path) -> None:
    module = _load("kafka_inventory_contract", ROOT / "infra/scripts/kafka-inventory-contract.py")
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    assert module.validate(document) == []
    reassignment = module.reassignment(document)
    assert reassignment["partitions"]
    assert all(item["replicas"] == [0, 1, 2] for item in reassignment["partitions"])
    malformed = dict(document)
    malformed["topics"] = [dict(document["topics"][0], replication_factor=1)]
    assert any("replication_factor" in error for error in module.validate(malformed))


def test_inventory_and_bootstrap_admin_and_security_parity() -> None:
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    script = BOOTSTRAP.read_text(encoding="utf-8")
    assert document["bootstrap"]["admin_principal"] == "kafka-admin"
    assert document["bootstrap"]["admin_password_secret_key"] == "platform-kafka-admin-password"
    assert 'username="kafka-admin"' in script
    assert "INVENTORY_AUTHORITY=infra/kafka/topic-inventory.yaml" in script
    assert "SASL_PLAINTEXT" not in script
    assert "--replication-factor 1" not in script
    acl_contract = document["acl_contract"]
    assert acl_contract["application_super_users_forbidden"]
    assert acl_contract["unauthorized_acl_probe"]["expected"] == "DENIED"
    assert acl_contract["bootstrap_order"] == "reassignment-verified-before-acl-bootstrap"
    assert acl_contract["transactional_id_policy"] in {"none-used", "service-principal-prefixed-and-explicit"}
    assert "kafka-admin" in script


def test_migration_contract_covers_secure_cutover_and_rollback() -> None:
    migration = yaml.safe_load(MIGRATION.read_text(encoding="utf-8"))
    assert migration["listeners"]["client"] == "CLIENT:SASL_SSL"
    assert migration["listeners"]["inter_broker"] == "INTERNAL:SSL"
    assert migration["listeners"]["controller"] == "CONTROLLER:SSL"
    assert migration["certificate_contract"]["hostname_verification"] == "HTTPS"
    assert migration["certificate_contract"]["required_eku"] == "serverAuth,clientAuth"
    assert migration["maintenance_order"][0] == "pause-or-drain-producers-and-consumers"
    assert migration["reassignment_execution"]["rollback"]


def test_production_client_configs_have_no_plaintext_fallback() -> None:
    video = VIDEO_CONFIG.read_text(encoding="utf-8")
    finance = FINANCE_CONFIG.read_text(encoding="utf-8")
    assert "on-profile: local-only-dev" in video
    assert "on-profile: local-only-docker" in video
    assert "security.protocol: PLAINTEXT" not in video
    assert "security.protocol: SASL_PLAINTEXT" not in video
    assert "security-protocol: ${KAFKA_SECURITY_PROTOCOL:SASL_SSL}" in finance


def test_failure_drill_rejects_production_and_missing_authentication(tmp_path: Path) -> None:
    target = tmp_path / "target.yaml"
    target.write_text("name: production\nproduction: true\nisolated: false\n", encoding="utf-8")
    completed = subprocess.run([sys.executable, str(DRILL), "--target", str(target), "--expected-cluster-id", "fixture"], capture_output=True, text=True, check=False)
    payload = json.loads(completed.stdout)
    assert completed.returncode != 0
    assert payload["status"] == "FAIL"
    assert "production" in payload["errors"][0]


def test_failure_drill_rejects_missing_client_identity(tmp_path: Path) -> None:
    target = tmp_path / "target.yaml"
    target.write_text("name: isolated-fixture\nproduction: false\nisolated: true\ncluster_id: fixture\nnamespace: kafka-fixture\nbootstrap_servers: [kafka:9092]\n", encoding="utf-8")
    completed = subprocess.run([sys.executable, str(DRILL), "--target", str(target), "--expected-cluster-id", "fixture"], capture_output=True, text=True, check=False)
    payload = json.loads(completed.stdout)
    assert completed.returncode != 0
    assert payload["status"] == "FAIL"
    assert "principal" in payload["errors"][0]


def test_failure_drill_rejects_plaintext_bootstrap_before_external_operation(tmp_path: Path) -> None:
    target = tmp_path / "target.yaml"
    target.write_text("name: isolated-plaintext\nproduction: false\nisolated: true\ncluster_id: fixture\nnamespace: kafka-fixture\nbootstrap_servers: [PLAINTEXT://kafka:9092]\ncredential_principal: svc-drill\n", encoding="utf-8")
    completed = subprocess.run([sys.executable, str(DRILL), "--target", str(target), "--expected-cluster-id", "fixture"], capture_output=True, text=True, check=False)
    payload = json.loads(completed.stdout)
    assert completed.returncode != 0
    assert payload["status"] == "FAIL"
    assert "plaintext" in payload["errors"][0]


def test_failure_drill_rejects_cluster_identity_mismatch(tmp_path: Path) -> None:
    target = tmp_path / "target.yaml"
    target.write_text("name: isolated-fixture\nproduction: false\nisolated: true\ncluster_id: actual\nnamespace: kafka-fixture\nbootstrap_servers: [kafka:9092]\ncredential_principal: svc-drill\n", encoding="utf-8")
    completed = subprocess.run([sys.executable, str(DRILL), "--target", str(target), "--expected-cluster-id", "expected"], capture_output=True, text=True, check=False)
    payload = json.loads(completed.stdout)
    assert completed.returncode != 0
    assert payload["status"] == "FAIL"
    assert "cluster identity" in payload["errors"][0]


def test_failure_drill_blocks_without_real_authenticated_cluster(tmp_path: Path) -> None:
    target = tmp_path / "target.yaml"
    target.write_text("name: isolated-fixture\nproduction: false\nisolated: true\ncluster_id: fixture\nnamespace: kafka-fixture\nbootstrap_servers: [kafka:9092]\ncredential_principal: svc-drill\nca_certificate: fixture-ca\nclient_certificate: fixture-client\nsasl_mechanism: PLAIN\njaas_secret: fixture-jaas\nhostname_verification: HTTPS\n", encoding="utf-8")
    completed = subprocess.run([sys.executable, str(DRILL), "--target", str(target), "--expected-cluster-id", "fixture"], capture_output=True, text=True, check=False)
    payload = json.loads(completed.stdout)
    assert completed.returncode != 0
    assert payload["status"] == "BLOCKED_EXTERNAL"
    assert payload["authenticated_cluster"] is False


def test_failure_drill_rejects_missing_tls_or_jaas_material(tmp_path: Path) -> None:
    target = tmp_path / "target.yaml"
    target.write_text("name: isolated-fixture\nproduction: false\nisolated: true\ncluster_id: fixture\nnamespace: kafka-fixture\nbootstrap_servers: [kafka:9092]\ncredential_principal: svc-drill\n", encoding="utf-8")
    completed = subprocess.run([sys.executable, str(DRILL), "--target", str(target), "--expected-cluster-id", "fixture"], capture_output=True, text=True, check=False)
    payload = json.loads(completed.stdout)
    assert completed.returncode != 0
    assert payload["status"] == "FAIL"
    assert "CA/client certificate" in payload["errors"][0]


def test_production_workload_does_not_use_plaintext_kafka() -> None:
    workloads = (ROOT / "infra/k8s/base/workloads.yaml").read_text(encoding="utf-8")
    assert "MODERATOR_KAFKA_SECURITY_PROTOCOL\n          value: SASL_PLAINTEXT" not in workloads
    assert "MODERATOR_KAFKA_SSL_CA_FILE" in workloads
    assert "MODERATOR_KAFKA_SSL_CERT_FILE" in workloads
    assert "MODERATOR_KAFKA_SSL_KEY_FILE" in workloads


def test_java_production_clients_require_mutual_tls_material_and_delivery_policy() -> None:
    for path in JAVA_KAFKA_CONFIGS:
        document = path.read_text(encoding="utf-8")
        assert "KAFKA_SSL_TRUSTSTORE_LOCATION" in document, path
        assert "ssl.keystore.location: ${KAFKA_SSL_KEYSTORE_LOCATION" in document, path
        assert "ssl.endpoint.identification.algorithm: https" in document, path
        assert "KAFKA_SSL_TRUSTSTORE_PASSWORD" in document, path
        assert "KAFKA_SSL_KEYSTORE_PASSWORD" in document, path
    for path in (JAVA_KAFKA_CONFIGS[0], JAVA_KAFKA_CONFIGS[1], JAVA_KAFKA_CONFIGS[2]):
        document = path.read_text(encoding="utf-8")
        assert "acks: all" in document or "enable.idempotence: true" in document, path


def test_search_and_recommendations_admin_health_reuse_secure_spring_properties() -> None:
    for service in ("search-service", "recommendations-service"):
        config = (ROOT / f"services/{service}/src/main/java/com/vnshop/{'searchservice' if service == 'search-service' else 'recommendationsservice'}/infrastructure/config/KafkaAdminConfig.java").read_text(encoding="utf-8")
        health = (ROOT / f"services/{service}/src/main/java/com/vnshop/{'searchservice' if service == 'search-service' else 'recommendationsservice'}/infrastructure/health/KafkaHealthConfig.java").read_text(encoding="utf-8")
        assert "SASL_PLAINTEXT" not in config
        assert "KafkaProperties" in config
        assert "buildAdminProperties" in config
        assert "KafkaAdmin kafkaAdmin" in config
        assert "kafkaAdmin.getConfigurationProperties()" in health


def test_kafka_workloads_mount_service_tls_material() -> None:
    workloads = WORKLOADS.read_text(encoding="utf-8")
    for service in ("messaging", "notification"):
        start = workloads.index(f"      - name: {service}-service") if service not in {"messaging", "notification", "seller-finance", "video-transcoder"} else workloads.index(f"      - name: {service}-service")
        next_start = workloads.find("\n---", start + 1)
        block = workloads[start: next_start if next_start >= 0 else len(workloads)]
        assert "KAFKA_SSL_CA_FILE" in block or "KAFKA_SSL_TRUSTSTORE_LOCATION" in block, service
        assert "KAFKA_SSL_CERT_FILE" in block or "KAFKA_SSL_KEYSTORE_LOCATION" in block, service
        assert "KAFKA_SSL_KEY_FILE" in block or "KAFKA_SSL_KEYSTORE_LOCATION" in block, service
        assert "name: kafka-tls" in block, service


def test_kafkajs_clients_use_shared_fail_closed_tls_boundary() -> None:
    for path in KAFKAJS_CONFIGS:
        document = path.read_text(encoding="utf-8")
        assert "createKafkaClientConfig" in document, path
        assert "ssl: true" not in document, path
        assert "KAFKA_SASL_PASSWORD ??" not in document, path
        if "publisher" in path.name:
            assert "createKafkaProducerConfig" in document, path


def test_inventory_acl_authority_is_mechanically_checked_in_both_bootstraps() -> None:
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    module = _load("kafka_inventory_contract_parity", ROOT / "infra/scripts/kafka-inventory-contract.py")
    assert module.validate_bootstrap_authority(document, BOOTSTRAP.read_text(encoding="utf-8")) == []
    k8s = (ROOT / "infra/k8s/base/kafka-bootstrap-job.yaml").read_text(encoding="utf-8")
    assert module.validate_kubernetes_bootstrap_authority(document, k8s) == []


def test_inventory_acl_semantics_reject_each_mutated_dimension() -> None:
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    module = _load("kafka_inventory_acl_semantics", ROOT / "infra/scripts/kafka-inventory-contract.py")
    for field, value in (("principal", "User:wrong"), ("operation", "Read"), ("resource_type", "group"), ("resource_name", "wrong"), ("pattern_type", "literal")):
        mutated = yaml.safe_load(yaml.safe_dump(document))
        mutated["acl_entries"][0][field] = value
        assert any("ACL" in error for error in module.validate(mutated)), field

    mutated_script = BOOTSTRAP.read_text(encoding="utf-8").replace("--operation Write --topic payment.completed", "--operation Read --topic payment.completed", 1)
    assert any("ACL" in error for error in module.validate_bootstrap_authority(document, mutated_script))


def test_notification_loop_expands_only_declared_consumer_topics() -> None:
    module = _load("kafka_inventory_notification_loop", ROOT / "infra/scripts/kafka-inventory-contract.py")
    script = BOOTSTRAP.read_text(encoding="utf-8")
    entries = module._extract_acl_entries(script)
    notification_topics = {entry[3] for entry in entries if entry[0] == "User:svc-notification" and entry[2] == "topic"}
    assert notification_topics == {
        "order.created", "order.cancelled", "order.shipped", "order.delivered", "payment.completed",
        "payment.refunded", "product.approved", "product.rejected", "review.replied", "return.requested",
        "payout.completed", "user.registered", "user.password-reset", "video.published", "video.rejected",
    }


def test_duplicate_acl_commands_and_missing_admin_identity_fail() -> None:
    module = _load("kafka_inventory_duplicate_acl", ROOT / "infra/scripts/kafka-inventory-contract.py")
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    script = BOOTSTRAP.read_text(encoding="utf-8")
    duplicate = script + "\n$ACL --add --allow-principal User:svc-order --operation Write --topic payment.refund.requested\n"
    assert any("duplicate" in error for error in module.validate_bootstrap_authority(document, duplicate))
    without_admin = yaml.safe_load(yaml.safe_dump(document))
    without_admin["clients"] = [client for client in without_admin["clients"] if client["service"] != "kafka-admin-bootstrap"]
    assert any("clients" in error for error in module.validate(without_admin))


def test_inventory_validates_workload_runtime_bindings_and_local_compose_mode() -> None:
    module = _load("kafka_inventory_workload_bindings", ROOT / "infra/scripts/kafka-inventory-contract.py")
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    assert module.validate(document) == []
    compose = COMPOSE.read_text(encoding="utf-8")
    for service in ("messaging-service", "notification-service"):
        start = compose.index(f"  {service}:")
        next_service_match = re.search(r"\n  [a-z][a-z0-9-]+:\n", compose[start + 3:])
        next_service = start + 3 + next_service_match.start() if next_service_match else -1
        block = compose[start:next_service] if next_service >= 0 else compose[start:]
        assert "KAFKA_LOCAL_MODE: plaintext" in block


def test_transactional_policy_is_explicit_and_principal_prefixed() -> None:
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    assert document["acl_contract"]["transactional_id_policy"] in {"none-used", "service-principal-prefixed-and-explicit"}
    for entry in document["acl_contract"]["transactional_ids"]:
        assert entry["id_prefix"].startswith(entry["principal"] + "-")
        assert entry["acl_operation"] == "Write"

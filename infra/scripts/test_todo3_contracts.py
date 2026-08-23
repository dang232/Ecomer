"""Behavioral contract tests for the production Kafka authority and drill guards."""
from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import sys
import shutil
import tempfile
from pathlib import Path

import pytest
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
TOPOLOGY = ROOT / "infra/scripts/k8s-topology-contract.py"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _git_bash() -> str | None:
    git = shutil.which("git.exe") or shutil.which("git")
    candidates = []
    if git:
        candidates.append(Path(git).resolve().parent / "bash.exe")
    candidates.extend((Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Git" / "bin" / "bash.exe", Path(os.environ.get("LocalAppData", "")) / "Programs" / "Git" / "bin" / "bash.exe"))
    return next((str(path) for path in candidates if path.is_file()), None)


def _run_bash(script_path: Path, root: Path, hostname: str) -> subprocess.CompletedProcess[str]:
    bash = _git_bash()
    assert bash
    return subprocess.run([bash, "--noprofile", "--norc", str(script_path)], cwd=root, env={**os.environ, "HOSTNAME": hostname}, capture_output=True, text=True, check=False)


def _wsl_bash_available() -> bool:
    result = subprocess.run(["wsl.exe", "--exec", "/bin/bash", "-lc", "true"], capture_output=True, check=False)
    return result.returncode == 0


def test_secure_authority_has_three_brokers_and_no_plaintext() -> None:
    documents = [doc for doc in yaml.safe_load_all(STATEFULSET.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    kafka = next(doc for doc in documents if doc.get("kind") == "StatefulSet" and doc.get("metadata", {}).get("name") == "kafka")
    rendered = STATEFULSET.read_text(encoding="utf-8")
    assert kafka["spec"]["replicas"] == 3
    assert "SASL_SSL" in rendered and "CLIENT:SASL_SSL" in rendered
    assert "CONTROLLER:SSL" in rendered and "INTERNAL:SSL" in rendered
    assert "PLAINTEXT" not in rendered
    assert "replication_factor: 1" not in INVENTORY.read_text(encoding="utf-8")


def test_topology_accepts_init_generated_kraft_authority_and_rejects_mutations() -> None:
    topology = _load("kafka_topology_contract", TOPOLOGY)
    documents = [doc for doc in yaml.safe_load_all(STATEFULSET.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    kafka = next(doc for doc in documents if doc.get("kind") == "StatefulSet")
    assert topology._check_kafka(kafka) == []
    assert kafka["spec"]["podManagementPolicy"] == "Parallel"
    assert kafka["spec"]["updateStrategy"]["type"] == "RollingUpdate"
    assert kafka["spec"]["template"]["spec"]["enableServiceLinks"] is False
    main = next(container for container in kafka["spec"]["template"]["spec"]["containers"] if container.get("name") == "kafka")
    main_env = {entry["name"]: entry.get("value") for entry in main["env"] if "name" in entry}
    assert main_env["KAFKA_CONTROLLER_QUORUM_VOTERS"] == "0@kafka-0.kafka-headless:9093,1@kafka-1.kafka-headless:9093,2@kafka-2.kafka-headless:9093"
    assert main_env["KAFKA_LISTENERS"] == "CLIENT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093,INTERNAL://0.0.0.0:9094"
    init = next(container for container in kafka["spec"]["template"]["spec"]["initContainers"] if container.get("name") == "kafka-init")
    init_properties = topology._init_properties(init)
    assert init_properties["advertised.listeners"] == "CLIENT://kafka:9092,INTERNAL://kafka-$ordinal.kafka-headless:9094"
    mutations = (
        ("main-voters", lambda value: value.replace("KAFKA_CONTROLLER_QUORUM_VOTERS, value: '0@kafka-0.kafka-headless:9093,1@kafka-1.kafka-headless:9093,2@kafka-2.kafka-headless:9093'", "KAFKA_CONTROLLER_QUORUM_VOTERS, value: '0@kafka-0.kafka-headless:9093,1@wrong:9093,2@kafka-2.kafka-headless:9093'", 1)),
        ("main-listeners", lambda value: value.replace("KAFKA_LISTENERS, value: 'CLIENT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093,INTERNAL://0.0.0.0:9094'", "KAFKA_LISTENERS, value: 'CLIENT://0.0.0.0:9092'", 1)),
        ("init-voters", lambda value: value.replace("controller.quorum.voters=0@kafka-0.kafka-headless:9093,1@kafka-1.kafka-headless:9093,2@kafka-2.kafka-headless:9093", "controller.quorum.voters=0@kafka-0.kafka-headless:9093,1@wrong:9093,2@kafka-2.kafka-headless:9093", 1)),
        ("init-listeners", lambda value: value.replace("listeners=CLIENT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093,INTERNAL://0.0.0.0:9094", "listeners=CLIENT://0.0.0.0:9092", 1)),
        ("init-advertised-missing", lambda value: value.replace("advertised.listeners=CLIENT://kafka:9092,INTERNAL://kafka-$ordinal.kafka-headless:9094\n", "", 1)),
        ("init-advertised-meta", lambda value: value.replace("advertised.listeners=CLIENT://kafka:9092,INTERNAL://kafka-$ordinal.kafka-headless:9094", "advertised.listeners=CLIENT://0.0.0.0:9092,INTERNAL://kafka-$ordinal.kafka-headless:9094", 1)),
        ("init-advertised-service", lambda value: value.replace("CLIENT://kafka:9092", "CLIENT://wrong-kafka:9092", 1)),
        ("init-advertised-ordinal", lambda value: value.replace("kafka-$ordinal.kafka-headless:9094", "kafka-0.kafka-headless:9094", 1)),
        ("main-advertised-service", lambda value: value.replace("CLIENT://kafka:9092,INTERNAL://$(POD_NAME).kafka-headless:9094", "CLIENT://wrong-kafka:9092,INTERNAL://$(POD_NAME).kafka-headless:9094", 1)),
        ("main-advertised-ordinal", lambda value: value.replace("INTERNAL://$(POD_NAME).kafka-headless:9094", "INTERNAL://kafka-0.kafka-headless:9094", 1)),
        ("service-links-missing", lambda value: value.replace("      enableServiceLinks: false\n", "", 1)),
        ("service-links-true", lambda value: value.replace("      enableServiceLinks: false", "      enableServiceLinks: true", 1)),
        ("pod-policy-missing", lambda value: value.replace("  podManagementPolicy: Parallel\n", "", 1)),
        ("pod-policy-ordered", lambda value: value.replace("  podManagementPolicy: Parallel", "  podManagementPolicy: OrderedReady", 1)),
        ("pod-policy-invalid", lambda value: value.replace("  podManagementPolicy: Parallel", "  podManagementPolicy: InvalidPolicy", 1)),
        ("deprecated-port", lambda value: value.replace("        - {name: KAFKA_PROCESS_ROLES, value: 'broker,controller'}", "        - {name: KAFKA_PORT, value: ''}\n        - {name: KAFKA_PROCESS_ROLES, value: 'broker,controller'}", 1)),
        ("deprecated-advertised-port", lambda value: value.replace("        - {name: KAFKA_PROCESS_ROLES, value: 'broker,controller'}", "        - {name: KAFKA_ADVERTISED_PORT, value: ''}\n        - {name: KAFKA_PROCESS_ROLES, value: 'broker,controller'}", 1)),
        ("deprecated-host", lambda value: value.replace("        - {name: KAFKA_PROCESS_ROLES, value: 'broker,controller'}", "        - {name: KAFKA_HOST, value: ''}\n        - {name: KAFKA_PROCESS_ROLES, value: 'broker,controller'}", 1)),
        ("deprecated-advertised-host", lambda value: value.replace("        - {name: KAFKA_PROCESS_ROLES, value: 'broker,controller'}", "        - {name: KAFKA_ADVERTISED_HOST, value: ''}\n        - {name: KAFKA_PROCESS_ROLES, value: 'broker,controller'}", 1)),
        ("node-id", lambda value: value.replace("node.id=$ordinal", "node.id=0", 1)),
        ("roles", lambda value: value.replace("process.roles=broker,controller", "process.roles=broker", 1)),
        ("log-dir", lambda value: value.replace("log.dirs=/var/lib/kafka/data", "log.dirs=/tmp/kafka", 1)),
        ("cluster-parity", lambda value: value.replace("key: platform-kafka-cluster-id", "key: wrong-cluster-id", 1)),
    )
    source = STATEFULSET.read_text(encoding="utf-8")
    for name, mutate in mutations:
        mutated = mutate(source)
        assert mutated != source, name
        mutated_kafka = next(doc for doc in yaml.safe_load_all(mutated) if isinstance(doc, dict) and doc.get("kind") == "StatefulSet")
        assert topology._check_kafka(mutated_kafka), name


def test_topology_binds_probe_bootstrap_to_not_ready_client_service() -> None:
    topology = _load("kafka_probe_service_contract", TOPOLOGY)
    documents = [doc for doc in yaml.safe_load_all(STATEFULSET.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    kafka = next(doc for doc in documents if doc.get("kind") == "StatefulSet" and doc.get("metadata", {}).get("name") == "kafka")
    services = [doc for doc in documents if doc.get("kind") == "Service"]
    assert topology._check_kafka_service_contract(kafka, documents) == []
    client = next(service for service in services if service["metadata"]["name"] == "kafka")
    assert client["spec"]["publishNotReadyAddresses"] is True
    assert client["spec"]["selector"] == {"app.kubernetes.io/name": "kafka"}

    mutations = (
        ("missing-publish-not-ready", lambda docs, service, kafka: service["spec"].pop("publishNotReadyAddresses")),
        ("false-publish-not-ready", lambda docs, service, kafka: service["spec"].update(publishNotReadyAddresses=False)),
        ("string-publish-not-ready", lambda docs, service, kafka: service["spec"].update(publishNotReadyAddresses="true")),
        ("selector-mismatch", lambda docs, service, kafka: service["spec"].update(selector={"app.kubernetes.io/name": "other"})),
        ("service-renamed", lambda docs, service, kafka: service["metadata"].update(name="kafka-client")),
        ("duplicate-service-document", lambda docs, service, kafka: docs.append(yaml.safe_load(yaml.safe_dump(service, sort_keys=False)))),
        ("missing-service-port", lambda docs, service, kafka: service["spec"].pop("ports")),
        ("wrong-service-port", lambda docs, service, kafka: service["spec"]["ports"][0].update(port=19092)),
        ("wrong-service-target-port", lambda docs, service, kafka: service["spec"]["ports"][0].update(targetPort="internal")),
        ("duplicate-service-port", lambda docs, service, kafka: service["spec"]["ports"].append(yaml.safe_load(yaml.safe_dump(service["spec"]["ports"][0], sort_keys=False)))),
        ("missing-container-client-port", lambda docs, service, kafka: kafka["spec"]["template"]["spec"]["containers"][0].pop("ports")),
        ("wrong-container-client-port", lambda docs, service, kafka: next(port for port in kafka["spec"]["template"]["spec"]["containers"][0]["ports"] if port["name"] == "client").update(containerPort=19092)),
        ("duplicate-container-client-port", lambda docs, service, kafka: kafka["spec"]["template"]["spec"]["containers"][0]["ports"].append(yaml.safe_load(yaml.safe_dump(next(port for port in kafka["spec"]["template"]["spec"]["containers"][0]["ports"] if port["name"] == "client"), sort_keys=False)))),
    )
    for name, mutate in mutations:
        mutated = yaml.safe_load(yaml.safe_dump(documents, sort_keys=False))
        service = next(service for service in mutated if service.get("kind") == "Service" and service.get("metadata", {}).get("name") in {"kafka", "kafka-client"})
        mutated_kafka = next(doc for doc in mutated if doc.get("kind") == "StatefulSet" and doc.get("metadata", {}).get("name") == "kafka")
        before = yaml.safe_dump(mutated, sort_keys=False)
        mutate(mutated, service, mutated_kafka)
        assert yaml.safe_dump(mutated, sort_keys=False) != before, name
        assert topology._check_kafka_service_contract(mutated_kafka, mutated), name


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


def _mutated_workloads(mutator) -> str:
    documents = [doc for doc in yaml.safe_load_all(WORKLOADS.read_text(encoding="utf-8-sig")) if isinstance(doc, dict)]
    mutator(documents)
    return "---\n".join(yaml.safe_dump(doc, sort_keys=False) for doc in documents)


def test_workload_tls_binding_mutations_fail_structural_validation() -> None:
    module = _load("kafka_inventory_workload_mutations", ROOT / "infra/scripts/kafka-inventory-contract.py")
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))

    def deployment(documents: list[dict], artifact: str) -> dict:
        return next(doc for doc in documents if doc.get("kind") == "Deployment" and doc.get("metadata", {}).get("labels", {}).get("vnshop.io/artifact-id") == artifact)

    def wrong_java_secret_item(documents: list[dict]) -> None:
        items = next(volume for volume in deployment(documents, "order-service")["spec"]["template"]["spec"]["volumes"] if volume["name"] == "kafka-tls")["secret"]["items"]
        items[0]["key"] = "wrong-truststore"

    def wrong_pem_secret_item(documents: list[dict]) -> None:
        items = next(volume for volume in deployment(documents, "messaging-service")["spec"]["template"]["spec"]["volumes"] if volume["name"] == "kafka-tls")["secret"]["items"]
        items[0]["key"] = "wrong-ca"

    def wrong_mount_path(documents: list[dict]) -> None:
        mounts = deployment(documents, "order-service")["spec"]["template"]["spec"]["containers"][0]["volumeMounts"]
        next(mount for mount in mounts if mount["name"] == "kafka-tls")["mountPath"] = "/wrong/tls"

    def wrong_video_volume(documents: list[dict]) -> None:
        pod = deployment(documents, "video-moderator")["spec"]["template"]["spec"]
        next(volume for volume in pod["volumes"] if volume["name"] == "kafka-client-tls")["name"] = "wrong-tls"

    def wrong_video_item(documents: list[dict]) -> None:
        items = next(volume for volume in deployment(documents, "video-moderator")["spec"]["template"]["spec"]["volumes"] if volume["name"] == "kafka-client-tls")["secret"]["items"]
        items[0]["key"] = "wrong-moderator-ca"

    for mutation in (wrong_java_secret_item, wrong_pem_secret_item, wrong_mount_path, wrong_video_volume, wrong_video_item):
        assert module._validate_workload_tls_bindings(document, _mutated_workloads(mutation)), mutation.__name__


def test_broker_auth_source_requires_external_secret_backed_jaas() -> None:
    module = _load("kafka_inventory_broker_auth", ROOT / "infra/scripts/kafka-inventory-contract.py")
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    manifest = (ROOT / "infra/k8s/kafka/kafka-statefulset.yaml").read_text(encoding="utf-8")
    assert module._validate_broker_auth_source(document, manifest) == []
    config_map = next(doc for doc in yaml.safe_load_all(manifest) if isinstance(doc, dict) and doc.get("kind") == "ConfigMap")
    assert "server.properties" not in config_map["data"]
    statefulset = next(doc for doc in yaml.safe_load_all(manifest) if isinstance(doc, dict) and doc.get("kind") == "StatefulSet")
    container = next(item for item in statefulset["spec"]["template"]["spec"]["containers"] if item.get("name") == "kafka")
    env_names = [entry["name"] for entry in container["env"] if "name" in entry]
    assert len(env_names) == len(set(env_names))
    env = {entry["name"]: entry.get("value") for entry in container["env"] if "name" in entry}
    cluster_id = next(entry for entry in container["env"] if entry.get("name") == "CLUSTER_ID")
    assert cluster_id["valueFrom"]["secretKeyRef"] == {"name": "vnshop-runtime-secrets", "key": "platform-kafka-cluster-id"}
    assert "KAFKA_CLUSTER_ID" not in env_names
    assert env["KAFKA_DEFAULT_REPLICATION_FACTOR"] == "3"
    assert env["KAFKA_MIN_INSYNC_REPLICAS"] == "2"
    assert env["KAFKA_SSL_KEYSTORE_LOCATION"] == "/etc/kafka/tls/broker.keystore.jks"
    assert env["KAFKA_SSL_TRUSTSTORE_LOCATION"] == "/etc/kafka/tls/ca.truststore.jks"
    assert "KAFKA_SSL_KEYSTORE_FILENAME" not in env
    assert "KAFKA_SSL_TRUSTSTORE_FILENAME" not in env
    assert not any(mount.get("subPath") == "server.properties" for mount in container.get("volumeMounts", []))
    init_script = "\n".join(statefulset["spec"]["template"]["spec"]["initContainers"][0].get("args", []))
    assert "node.id=$ordinal" in init_script
    assert "controller.quorum.voters=" in init_script
    assert "kafka-storage format --config /run/kafka-init/server.properties" in init_script
    tls_items = next(volume for volume in statefulset["spec"]["template"]["spec"]["volumes"] if volume.get("name") == "kafka-tls")["secret"]["items"]
    assert tls_items.count({"key": "platform-kafka-admin-keystore", "path": "admin.keystore.jks"}) == 1
    for probe_name in ("readinessProbe", "livenessProbe", "startupProbe"):
        command = " ".join(container[probe_name]["exec"]["command"])
        assert all(path in command for path in ("ca.truststore.jks", "admin.keystore.jks", "admin.properties"))
    for path in (STATEFULSET, MIGRATION, ROOT / "infra/scripts/kafka-inventory-contract.py", ROOT / "infra/scripts/test_todo3_contracts.py"):
        raw = path.read_bytes()
        assert not raw.startswith(b"\xef\xbb\xbf")
        assert b"\r\n" not in raw


@pytest.mark.skipif(_git_bash() is None, reason="Git Bash unavailable")
def test_broker_auth_entrypoint_generates_listener_scoped_jaas_and_rejects_hostile_credentials() -> None:
    manifest_documents = [doc for doc in yaml.safe_load_all(STATEFULSET.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    config_map = next(doc for doc in manifest_documents if doc.get("kind") == "ConfigMap")
    entrypoint = config_map["data"]["broker-jaas-entrypoint.sh"]
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        credentials = root / "credentials"
        runtime = root / "runtime"
        credentials.mkdir()
        runtime.mkdir()
        (credentials / "svc-test.username").write_text("svc-test", encoding="utf-8", newline="")
        (credentials / "svc-test.password").write_text("fixture-secret", encoding="utf-8", newline="")
        script = entrypoint.replace("/run/kafka-credentials", str(credentials).replace("\\", "/"))
        script = script.replace("/run/kafka-jaas", str(runtime).replace("\\", "/"))
        script = script.replace('test "${#username_files[@]}" = 15', 'test "${#username_files[@]}" = 1')
        script = script.replace('export KAFKA_NODE_ID="${HOSTNAME##*-}"', 'HOSTNAME=kafka-0\n    export KAFKA_NODE_ID="${HOSTNAME##*-}"')
        script = script.replace("exec /etc/confluent/docker/run", "exit 0")
        script_path = root / "entrypoint.sh"
        script_path.write_text(script, encoding="utf-8", newline="\n")
        script_path.chmod(0o700)
        result = _run_bash(script_path, root, "kafka-0")
        assert result.returncode == 0, result.stderr
        generated = (runtime / "kafka_server_jaas.conf").read_text(encoding="utf-8")
        assert "client.KafkaServer" in generated
        assert 'user_svc-test="fixture-secret"' in generated
        assert "chmod 600" in script

        hostile_contents = {
            "wrong username": ("other-user", "fixture-secret"),
            "duplicate username": ("svc-test", "fixture-secret"),
            "missing password": ("svc-test", None),
            "empty username": ("", "fixture-secret"),
            "newline injection": ("svc-test\nextra", "fixture-secret"),
            "quote injection": ("svc-test", 'fixture"secret'),
            "backslash injection": ("svc-test", r"fixture\secret"),
            "NUL in username": ("svc-test\x00extra", "fixture-secret"),
            "NUL in password": ("svc-test", "fixture\x00secret"),
        }
        for name, (username, password) in hostile_contents.items():
            for path in credentials.iterdir():
                path.unlink()
            (credentials / "svc-test.username").write_text(username, encoding="utf-8", newline="")
            if password is not None:
                (credentials / "svc-test.password").write_text(password, encoding="utf-8", newline="")
            if name == "duplicate username":
                (credentials / "svc-test-copy.username").write_text("svc-test", encoding="utf-8", newline="")
                (credentials / "svc-test-copy.password").write_text("fixture-secret", encoding="utf-8", newline="")
            result = _run_bash(script_path, root, "kafka-0")
            assert result.returncode != 0, name


def test_broker_entrypoint_uses_only_utilities_present_in_pinned_image() -> None:
    image = "confluentinc/cp-kafka@sha256:acbbf674f2ed40e5d0a8ca51beb0f00692c866fc22b5ce06f8cadbdc54cd4436"
    utilities = ("bash", "tr", "grep", "sha256sum", "awk")
    command = "set -euo pipefail; for utility in " + " ".join(utilities) + "; do command -v \"$utility\" >/dev/null; done; ! command -v cmp >/dev/null 2>&1; ! command -v perl >/dev/null 2>&1"
    result = subprocess.run(["docker", "run", "--rm", image, "bash", "-ec", command], capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr


def test_broker_auth_manifest_requires_principal_derived_secret_paths_and_certificate_mapping() -> None:
    module = _load("kafka_inventory_broker_mapping", ROOT / "infra/scripts/kafka-inventory-contract.py")
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    manifest = STATEFULSET.read_text(encoding="utf-8")
    migration = MIGRATION.read_text(encoding="utf-8")
    assert module._validate_broker_auth_source(document, manifest, migration) == []
    for mutation in (
        lambda value: value.replace("svc-order.username", "wrong.username", 1),
        lambda value: value.replace("key: order-service-kafka-username, path: svc-order.username", "key: payment-service-kafka-username, path: svc-order.username", 1),
        lambda value: value.replace("kafka-admin.username", "svc-order.username", 1),
        lambda value: value.replace("key: payment-service-kafka-username, path: svc-payment.username", "key: payment-service-kafka-username, path: svc-order.username", 1),
        lambda value: value.replace("key: payment-service-kafka-password, path: svc-payment.password", "key: order-service-kafka-password, path: svc-order.password", 1),
        lambda value: value.replace("client.KafkaServer", "KafkaServer", 1),
        lambda value: value.replace("KAFKA_SSL_PRINCIPAL_MAPPING_RULES, value: 'RULE:^CN=(kafka-node),O=VNShop$/$1/,DEFAULT'", "KAFKA_SSL_PRINCIPAL_MAPPING_RULES, value: 'RULE:^CN=wrong$/$1/'", 1),
        lambda value: value.replace("KAFKA_SSL_PRINCIPAL_MAPPING_RULES, value: 'RULE:^CN=(kafka-node),O=VNShop$/$1/,DEFAULT'", "KAFKA_SSL_PRINCIPAL_MAPPING_RULES, value: 'RULE:^CN=wrong$/$1/'", 1),
        lambda value: value.replace("KAFKA_SUPER_USERS, value: 'User:kafka-node;User:kafka-admin'", "KAFKA_SUPER_USERS, value: 'User:kafka-controller;User:kafka-admin'", 1),
        lambda value: value.replace("key: platform-kafka-broker-keystore, path: broker.keystore.jks", "key: missing-broker-keystore, path: broker.keystore.jks", 1),
    ):
        errors = module._validate_broker_auth_source(document, mutation(manifest), migration)
        assert errors, mutation


def test_broker_auth_validator_rejects_admin_tls_projection_and_probe_drift() -> None:
    module = _load("kafka_inventory_admin_tls_mutations", ROOT / "infra/scripts/kafka-inventory-contract.py")
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    manifest = STATEFULSET.read_text(encoding="utf-8")
    mutations = (
        ("missing-admin-keystore", lambda value: value.replace("          - {key: platform-kafka-admin-keystore, path: admin.keystore.jks}\n", "", 1)),
        ("wrong-admin-key", lambda value: value.replace("platform-kafka-admin-keystore, path: admin.keystore.jks", "platform-kafka-broker-keystore, path: admin.keystore.jks", 1)),
        ("wrong-admin-path", lambda value: value.replace("platform-kafka-admin-keystore, path: admin.keystore.jks", "platform-kafka-admin-keystore, path: wrong.keystore.jks", 1)),
        ("duplicate-admin-path", lambda value: value.replace("          - {key: platform-kafka-admin-keystore, path: admin.keystore.jks}\n", "          - {key: platform-kafka-admin-keystore, path: admin.keystore.jks}\n          - {key: platform-kafka-truststore, path: admin.keystore.jks}\n", 1)),
        ("probe-missing-admin-keystore", lambda value: value.replace(" -r /etc/kafka/tls/admin.keystore.jks", "", 1)),
        ("probe-wrong-admin-path", lambda value: value.replace("/etc/kafka/tls/admin.keystore.jks", "/etc/kafka/tls/wrong.keystore.jks", 1)),
    )
    for name, mutate in mutations:
        mutated = mutate(manifest)
        assert mutated != manifest, name
        assert module._validate_broker_auth_source(document, mutated, MIGRATION.read_text(encoding="utf-8")), name


def test_broker_auth_validator_rejects_literal_credentials_and_missing_runtime_contracts() -> None:
    module = _load("kafka_inventory_broker_negative_contracts", ROOT / "infra/scripts/kafka-inventory-contract.py")
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    manifest = STATEFULSET.read_text(encoding="utf-8")
    migration = MIGRATION.read_text(encoding="utf-8")
    mutations = (
        ("init-workspace", lambda value: value.replace("medium: Memory", "medium: Disk", 1)),
        ("jaas-options", lambda value: value.replace("export KAFKA_OPTS=", "export KAFKA_OPTIONS=", 1)),
        ("mapping-env", lambda value: value.replace("KAFKA_SSL_PRINCIPAL_MAPPING_RULES", "KAFKA_SSL_PRINCIPAL_MAPPING_WRONG", 1)),
        ("literal-credential", lambda value: value.replace("printf '  user_%s=\"%s\"\\n' \"$username\" \"$password\" >> \"$output\"", "printf '  user_svc-test=\"fixture-secret\"\\n' >> \"$output\"", 1)),
        ("admin-password", lambda value: value.replace("platform-kafka-admin-password", "missing-admin-password", 1)),
        ("cluster-id", lambda value: value.replace("key: platform-kafka-cluster-id", "key: missing-cluster-id", 1)),
    )
    for name, mutation in mutations:
        mutated = mutation(manifest)
        assert mutated != manifest, name
        assert module._validate_broker_auth_source(document, mutated, migration), name


def test_broker_auth_source_rejects_missing_duplicate_and_mismatched_secret_mappings() -> None:
    module = _load("kafka_inventory_broker_auth_mutations", ROOT / "infra/scripts/kafka-inventory-contract.py")
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    manifest = (ROOT / "infra/k8s/kafka/kafka-statefulset.yaml").read_text(encoding="utf-8")
    for mutation in (
        lambda value: value.replace("platform-kafka-admin-username", "missing-admin-username", 1),
        lambda value: value.replace("order-service-kafka-password", "payment-service-kafka-password", 1),
        lambda value: value.replace("export KAFKA_OPTS=", "listener.name.client.plain.sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required;\n    export KAFKA_OPTS=", 1),
    ):
        errors = module._validate_broker_auth_source(document, mutation(manifest))
        assert errors, mutation


def test_transactional_policy_is_explicit_and_principal_prefixed() -> None:
    document = yaml.safe_load(INVENTORY.read_text(encoding="utf-8"))
    assert document["acl_contract"]["transactional_id_policy"] in {"none-used", "service-principal-prefixed-and-explicit"}
    for entry in document["acl_contract"]["transactional_ids"]:
        assert entry["id_prefix"].startswith(entry["principal"] + "-")
        assert entry["acl_operation"] == "Write"

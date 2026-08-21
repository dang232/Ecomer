#!/usr/bin/env python3
"""Validate the versioned Kafka inventory and emit a deterministic reassignment file."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import yaml

BOOTSTRAP_SCRIPT = Path(__file__).resolve().parents[2] / "infra/scripts/init-kafka-topics.sh"
MIGRATION_CONTRACT = Path(__file__).resolve().parents[2] / "infra/kafka/migration-contract.yaml"


def _extract_topic_entries(script: str) -> set[tuple[str, int]]:
    return {
        (match.group(1), int(match.group(2)))
        for match in re.finditer(r'^\s+"([^":]+):(\d+)"$', script, re.MULTILINE)
    }


def _extract_acl_commands(script: str) -> set[str]:
    return {" ".join(line.strip().split()) for line in script.splitlines() if "$ACL --add" in line}


def _extract_kubernetes_script(document: str) -> str:
    marker = "  init-kafka-topics.sh: |\n"
    start = document.index(marker) + len(marker)
    end = document.index("\n---\napiVersion: batch/v1", start)
    return "\n".join(line[4:] if line.startswith("    ") else line for line in document[start:end].splitlines()) + "\n"


def validate_bootstrap_authority(document: dict, script: str) -> list[str]:
    inventory_topics = {(topic["name"], int(topic["partitions"])) for topic in document.get("topics", [])}
    return [] if _extract_topic_entries(script) == inventory_topics else ["bootstrap topic metadata must exactly match inventory"]


def validate_kubernetes_bootstrap_authority(document: dict, manifest: str) -> list[str]:
    local = BOOTSTRAP_SCRIPT.read_text(encoding="utf-8")
    try:
        kubernetes = _extract_kubernetes_script(manifest)
    except ValueError:
        return ["Kubernetes bootstrap Job must embed the local bootstrap authority"]
    errors = validate_bootstrap_authority(document, local)
    if _extract_topic_entries(local) != _extract_topic_entries(kubernetes):
        errors.append("Kubernetes bootstrap topics drift from local bootstrap authority")
    if _extract_acl_commands(local) != _extract_acl_commands(kubernetes):
        errors.append("Kubernetes bootstrap ACLs drift from local bootstrap authority")
    return errors


def validate(document: dict) -> list[str]:
    errors: list[str] = []
    if document.get("schema_version") != "kafka-topic-inventory.v1":
        errors.append("inventory schema_version must be kafka-topic-inventory.v1")
    bootstrap = document.get("bootstrap", {})
    if bootstrap.get("protocol") != "SASL_SSL" or bootstrap.get("listener") != "CLIENT":
        errors.append("bootstrap must use CLIENT SASL_SSL")
    if bootstrap.get("hostname_verification") != "HTTPS":
        errors.append("bootstrap hostname verification must be HTTPS")
    if bootstrap.get("admin_principal") != "kafka-admin":
        errors.append("bootstrap admin principal must be kafka-admin")
    if bootstrap.get("admin_password_secret_key") != "platform-kafka-admin-password":
        errors.append("bootstrap admin password secret key must be platform-kafka-admin-password")
    acl_contract = document.get("acl_contract", {})
    if acl_contract.get("bootstrap_order") != "reassignment-verified-before-acl-bootstrap":
        errors.append("ACL bootstrap must follow verified reassignment")
    if acl_contract.get("transactional_id_policy") not in {"service-principal-prefixed-and-explicit", "none-used"}:
        errors.append("transactional ID ACL policy must be explicit")
    if acl_contract.get("topic_acl_source") != "infra/k8s/base/kafka-bootstrap-job.yaml":
        errors.append("Kubernetes ACL source must be authoritative")
    if acl_contract.get("local_bootstrap_source") != "infra/scripts/init-kafka-topics.sh":
        errors.append("local bootstrap source must be recorded")
    script = BOOTSTRAP_SCRIPT.read_text(encoding="utf-8")
    parity_markers = (
        "INVENTORY_AUTHORITY=infra/kafka/topic-inventory.yaml",
        "security.protocol=SASL_SSL",
        'username="kafka-admin"',
        "--replication-factor 3",
        "VNSHOP_KAFKA_TARGET",
    )
    for marker in parity_markers:
        if marker not in script:
            errors.append(f"bootstrap script is missing inventory parity marker: {marker}")
    if "SASL_PLAINTEXT" in script or "PLAINTEXT" in script or "--replication-factor 1" in script:
        errors.append("bootstrap script contains insecure protocol or RF1 path")
    script_topics = set(re.findall(r'^\s+"([^":]+):\d+"$', script, re.MULTILINE))
    topics = document.get("topics")
    if not isinstance(topics, list) or not topics:
        errors.append("topics must be a non-empty list")
    else:
        names: set[str] = set()
        for topic in topics:
            name = topic.get("name")
            if not isinstance(name, str) or not name or name in names:
                errors.append(f"duplicate or invalid topic: {name!r}")
            names.add(name)
            if topic.get("replication_factor") != 3:
                errors.append(f"topic {name} must have replication_factor=3")
            if topic.get("min_insync_replicas") != 2:
                errors.append(f"topic {name} must have min_insync_replicas=2")
            if int(topic.get("partitions", 0)) < 1:
                errors.append(f"topic {name} must have positive partitions")
    clients = document.get("clients")
    if not isinstance(clients, list) or len(clients) < 14:
        errors.append("inventory must cover all 13 application clients and admin bootstrap")
    else:
        identities: set[str] = set()
        for client in clients:
            service = client.get("service")
            if service in identities:
                errors.append(f"duplicate client identity: {service}")
            identities.add(service)
            for field in ("bootstrap", "protocol", "mechanism", "ca_secret", "client_cert_secret", "client_key_secret", "username_secret", "password_secret", "principal", "fallback"):
                if not client.get(field):
                    errors.append(f"client {service} missing {field}")
            if client.get("protocol") != "SASL_SSL" or client.get("hostname_verification") != "HTTPS":
                errors.append(f"client {service} is not secure SASL_SSL with hostname verification")
            if client.get("fallback") != "fail-closed" and service != "kafka-admin-bootstrap":
                errors.append(f"client {service} has non-fail-closed fallback")
    inventory_topics = {topic["name"] for topic in topics} if isinstance(topics, list) else set()
    if script_topics != inventory_topics:
        errors.append("local bootstrap topic list must exactly match inventory")
    errors.extend(validate_bootstrap_authority(document, script))
    try:
        migration = yaml.safe_load(MIGRATION_CONTRACT.read_text(encoding="utf-8"))
        if migration.get("listeners") != {"client": "CLIENT:SASL_SSL", "inter_broker": "INTERNAL:SSL", "controller": "CONTROLLER:SSL"}:
            errors.append("migration listener matrix is not the secure production contract")
        certificate = migration.get("certificate_contract", {})
        if certificate.get("hostname_verification") != "HTTPS" or certificate.get("required_eku") != "serverAuth,clientAuth":
            errors.append("migration certificate SAN/EKU contract is incomplete")
    except (OSError, TypeError, ValueError, yaml.YAMLError) as exc:
        errors.append(f"migration contract unavailable: {exc}")
    return sorted(set(errors))


def reassignment(document: dict) -> dict:
    return {
        "version": 1,
        "partitions": [
            {"topic": topic["name"], "partition": partition, "replicas": [0, 1, 2]}
            for topic in document["topics"]
            for partition in range(topic["partitions"])
        ],
        "throttle": {"leader": 0, "replica": 0},
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", type=Path, default=Path("infra/kafka/topic-inventory.yaml"))
    parser.add_argument("--reassignment", type=Path)
    args = parser.parse_args()
    try:
        document = yaml.safe_load(args.inventory.read_text(encoding="utf-8"))
        if not isinstance(document, dict):
            raise ValueError("inventory must be a mapping")
        errors = validate(document)
        if errors:
            print(json.dumps({"schema_version": "kafka-inventory-contract.v1", "status": "FAIL", "errors": errors}, indent=2))
            return 1
        output = reassignment(document)
        if args.reassignment:
            args.reassignment.parent.mkdir(parents=True, exist_ok=True)
            args.reassignment.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({"schema_version": "kafka-inventory-contract.v1", "status": "PASS", "topic_count": len(document["topics"]), "client_count": len(document["clients"]), "reassignment_partition_count": len(output["partitions"]), "reassignment_execution": "operator-only; apply/monitor/abort/rollback/cleanup require authenticated isolated-cluster evidence"}, indent=2))
        return 0
    except (OSError, TypeError, ValueError, yaml.YAMLError) as exc:
        print(json.dumps({"schema_version": "kafka-inventory-contract.v1", "status": "BLOCKED_EXTERNAL", "errors": [str(exc)]}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Fail-closed topology and authority checks for the rendered production graph."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
CANONICAL_OVERLAY = ROOT / "infra/k8s/overlays/prod"


def _env(container: dict) -> dict[str, str]:
    values: dict[str, str] = {}
    for entry in container.get("env", []):
        if isinstance(entry, dict) and isinstance(entry.get("name"), str) and "value" in entry:
            values[entry["name"]] = str(entry["value"])
    return values


def _secret_ref(container: dict, name: str) -> dict[str, str] | None:
    for entry in container.get("env", []):
        if isinstance(entry, dict) and entry.get("name") == name:
            ref = entry.get("valueFrom", {}).get("secretKeyRef")
            return ref if isinstance(ref, dict) else None
    return None


def _init_properties(init_container: dict) -> dict[str, str]:
    script = "\n".join(str(arg) for arg in init_container.get("args", []))
    match = re.search(r"cat > /run/kafka-init/server\.properties <<EOF\n(?P<properties>.*?)\n\s*EOF", script, re.DOTALL)
    if not match:
        return {}
    properties: dict[str, str] = {}
    for line in match.group("properties").splitlines():
        key, separator, value = line.strip().partition("=")
        if separator:
            properties[key] = value
    return properties


def _advertised_listener_error(value: str, expected: str) -> str | None:
    unsafe = ("0.0.0.0", "localhost", "127.0.0.1", "::")
    if not value:
        return "advertised.listeners is missing"
    if any(token in value.lower() for token in unsafe):
        return "advertised.listeners contains a non-routable address"
    if "CONTROLLER://" in value:
        return "advertised.listeners must not advertise the CONTROLLER endpoint"
    if value != expected:
        return "advertised.listeners has the wrong routable endpoint"
    return None


def _normalize_advertised_template(value: str) -> str:
    return value.replace("kafka-$ordinal", "$(POD_NAME)")


def _probe_bootstrap_servers(kafka: dict) -> list[str]:
    servers: list[str] = []
    pod = kafka.get("spec", {}).get("template", {}).get("spec", {})
    main = next((container for container in pod.get("containers", []) if container.get("name") == "kafka"), {})
    for probe_name in ("startupProbe", "readinessProbe", "livenessProbe"):
        command = " ".join(str(value) for value in main.get(probe_name, {}).get("exec", {}).get("command", []))
        servers.extend(re.findall(r"--bootstrap-server\s+(\S+)", command))
    return servers


def _kafka_main_container(kafka: dict) -> dict:
    containers = kafka.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
    return next((container for container in containers if container.get("name") == "kafka"), {})


def _check_kafka_service_contract(kafka: dict, documents: list[dict]) -> list[str]:
    errors: list[str] = []
    bootstrap_servers = _probe_bootstrap_servers(kafka)
    if bootstrap_servers != ["kafka:9092"] * 3:
        errors.append("Kafka startup/readiness/liveness probes must bootstrap through kafka:9092")
        return errors

    client_services = [
        document
        for document in documents
        if document.get("kind") == "Service" and document.get("metadata", {}).get("name") == "kafka"
    ]
    if len(client_services) != 1:
        errors.append("exactly one client Service/kafka is required for Kafka probe bootstrap")
        return errors
    service = client_services[0]
    spec = service.get("spec", {})
    if spec.get("selector") != {"app.kubernetes.io/name": "kafka"}:
        errors.append("Kafka client Service selector must match the Kafka pod selector")
    if spec.get("publishNotReadyAddresses") is not True:
        errors.append("Kafka client Service must publish not-ready addresses")
    service_ports = spec.get("ports", [])
    matching_service_ports = [
        port
        for port in service_ports
        if isinstance(port, dict) and port.get("port") == 9092 and port.get("targetPort") == "client"
    ]
    if len(matching_service_ports) != 1:
        errors.append("Kafka client Service must expose exactly one port 9092 targeting named client")
    main = _kafka_main_container(kafka)
    client_ports = [
        port
        for port in main.get("ports", [])
        if isinstance(port, dict) and port.get("name") == "client"
    ]
    if len(client_ports) != 1:
        errors.append("Kafka main container must expose exactly one named client port")
    elif client_ports[0].get("containerPort") != 9092:
        errors.append("Kafka main container named client port must be 9092")
    return errors


def _check_kafka(kafka: dict) -> list[str]:
    errors: list[str] = []
    spec = kafka.get("spec", {})
    if spec.get("podManagementPolicy") != "Parallel":
        errors.append("Kafka podManagementPolicy must be exactly Parallel")
    pod = spec.get("template", {}).get("spec", {})
    if pod.get("enableServiceLinks") is not False:
        errors.append("Kafka pod enableServiceLinks must be exactly false")
    containers = pod.get("containers", [])
    main = _kafka_main_container(kafka)
    env = _env(main)
    init = next((container for container in pod.get("initContainers", []) if container.get("name") == "kafka-init"), {})
    init_properties = _init_properties(init)
    expected_properties = {
        "process.roles": "broker,controller",
        "node.id": "$ordinal",
        "controller.quorum.voters": "0@kafka-0.kafka-headless:9093,1@kafka-1.kafka-headless:9093,2@kafka-2.kafka-headless:9093",
        "controller.listener.names": "CONTROLLER",
        "listeners": "CLIENT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093,INTERNAL://0.0.0.0:9094",
        "listener.security.protocol.map": "CLIENT:SASL_SSL,CONTROLLER:SSL,INTERNAL:SSL",
        "inter.broker.listener.name": "INTERNAL",
        "advertised.listeners": "CLIENT://kafka:9092,INTERNAL://kafka-$ordinal.kafka-headless:9094",
        "log.dirs": "/var/lib/kafka/data",
    }
    for key, expected in expected_properties.items():
        if init_properties.get(key) != expected:
            errors.append(f"Kafka init KRaft property is missing or incorrect: {key}")
    init_script = "\n".join(str(arg) for arg in init.get("args", []))
    if 'kafka-storage format --config /run/kafka-init/server.properties --cluster-id "$CLUSTER_ID"' not in init_script:
        errors.append("Kafka init formatting must use the runtime CLUSTER_ID")
    if env.get("KAFKA_PROCESS_ROLES") != "broker,controller":
        errors.append("Kafka main runtime process roles must be broker,controller")
    if env.get("KAFKA_CONTROLLER_QUORUM_VOTERS") != init_properties.get("controller.quorum.voters"):
        errors.append("Kafka main runtime quorum voters must equal init KRaft voters")
    if env.get("KAFKA_LISTENERS") != init_properties.get("listeners"):
        errors.append("Kafka main runtime listeners must equal init KRaft listeners")
    if env.get("KAFKA_LOG_DIRS") != "/var/lib/kafka/data":
        errors.append("Kafka main runtime log directory must be /var/lib/kafka/data")
    if env.get("KAFKA_LISTENER_SECURITY_PROTOCOL_MAP") != expected_properties["listener.security.protocol.map"]:
        errors.append("Kafka main runtime listener security map is incorrect")
    if env.get("KAFKA_INTER_BROKER_LISTENER_NAME") != "INTERNAL":
        errors.append("Kafka main runtime inter-broker listener must be INTERNAL")
    if env.get("KAFKA_CONTROLLER_LISTENER_NAMES") != "CONTROLLER":
        errors.append("Kafka main runtime controller listener must be CONTROLLER")
    if env.get("KAFKA_ADVERTISED_LISTENERS") != "CLIENT://kafka:9092,INTERNAL://$(POD_NAME).kafka-headless:9094":
        errors.append("Kafka advertised listeners are incorrect")
    init_advertised_error = _advertised_listener_error(init_properties.get("advertised.listeners", ""), expected_properties["advertised.listeners"])
    if init_advertised_error:
        errors.append(f"Kafka init {init_advertised_error}")
    main_advertised_error = _advertised_listener_error(env.get("KAFKA_ADVERTISED_LISTENERS", ""), "CLIENT://kafka:9092,INTERNAL://$(POD_NAME).kafka-headless:9094")
    if main_advertised_error:
        errors.append(f"Kafka main {main_advertised_error}")
    if _normalize_advertised_template(init_properties.get("advertised.listeners", "")) != env.get("KAFKA_ADVERTISED_LISTENERS"):
        errors.append("Kafka init and main advertised listeners must have semantic template parity")
    main_cluster = _secret_ref(main, "CLUSTER_ID")
    init_cluster = _secret_ref(init, "CLUSTER_ID")
    expected_cluster = {"name": "vnshop-runtime-secrets", "key": "platform-kafka-cluster-id"}
    if main_cluster != expected_cluster or init_cluster != expected_cluster or main_cluster != init_cluster:
        errors.append("Kafka init and main CLUSTER_ID Secret bindings must match")
    names = [entry.get("name") for entry in main.get("env", []) if isinstance(entry, dict)]
    if len(names) != len(set(names)):
        errors.append("Kafka main runtime environment contains duplicate names")
    deprecated_names = {"KAFKA_PORT", "KAFKA_ADVERTISED_PORT", "KAFKA_HOST", "KAFKA_ADVERTISED_HOST"}
    deprecated_present = sorted(deprecated_names & set(names))
    if deprecated_present:
        errors.append(f"Kafka main runtime contains deprecated environment variables: {', '.join(deprecated_present)}")
    tls_volumes = [volume for volume in pod.get("volumes", []) if volume.get("name") == "kafka-tls"]
    tls_items = [item for volume in tls_volumes for item in volume.get("secret", {}).get("items", [])]
    expected_tls = {
        "platform-kafka-broker-keystore": "broker.keystore.jks",
        "platform-kafka-admin-keystore": "admin.keystore.jks",
        "platform-kafka-truststore": "ca.truststore.jks",
        "platform-kafka-admin-client-properties": "admin.properties",
    }
    for secret_key, path in expected_tls.items():
        if len([item for item in tls_items if item.get("key") == secret_key and item.get("path") == path]) != 1:
            errors.append(f"Kafka TLS Secret mapping must contain exactly one {secret_key} -> {path}")
    if len({item.get("key") for item in tls_items}) != len(tls_items) or len({item.get("path") for item in tls_items}) != len(tls_items):
        errors.append("Kafka TLS Secret mappings must have unique keys and paths")
    for probe_name in ("readinessProbe", "livenessProbe", "startupProbe"):
        command = " ".join(str(value) for value in main.get(probe_name, {}).get("exec", {}).get("command", []))
        for path in ("/etc/kafka/tls/ca.truststore.jks", "/etc/kafka/tls/admin.keystore.jks", "/etc/kafka/tls/admin.properties"):
            if path not in command:
                errors.append(f"Kafka {probe_name} must check/read {path}")
    return errors


def _check_documents(documents: list[dict]) -> list[str]:
    """Check structured topology predicates only for an authenticated render."""
    errors: list[str] = []
    identities = [(d.get("kind"), d.get("metadata", {}).get("namespace", ""), d.get("metadata", {}).get("name")) for d in documents]
    for kind, namespace, name in sorted(set(identities)):
        if identities.count((kind, namespace, name)) > 1:
            errors.append(f"duplicate rendered authority: {kind}/{namespace}/{name}")
    kafka = [d for d in documents if d.get("kind") == "StatefulSet" and d.get("metadata", {}).get("name") == "kafka"]
    if len(kafka) != 1:
        errors.append("exactly one rendered Kafka StatefulSet is required")
    else:
        spec = kafka[0].get("spec", {})
        if spec.get("replicas") != 3:
            errors.append("production Kafka authority must have three replicas")
        containers = kafka[0].get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
        env = _env(containers[0]) if containers else {}
        listeners = f"{env.get('KAFKA_LISTENERS', '')},{env.get('KAFKA_ADVERTISED_LISTENERS', '')}".upper()
        if "PLAINTEXT" in listeners:
            errors.append("Kafka listeners must not use plaintext")
        if "SASL_SSL" not in env.get("KAFKA_LISTENER_SECURITY_PROTOCOL_MAP", ""):
            errors.append("Kafka listener security map must include SASL_SSL")
        if env.get("KAFKA_SSL_CLIENT_AUTH", "").lower() not in {"required", "requested"}:
            errors.append("Kafka client certificate authentication is required")
        if env.get("KAFKA_SSL_ENDPOINT_IDENTIFICATION_ALGORITHM", "").lower() != "https":
            errors.append("Kafka hostname verification must be enabled")
        required_kafka = {"KAFKA_AUTO_CREATE_TOPICS_ENABLE", "KAFKA_AUTHORIZER_CLASS_NAME", "KAFKA_CONTROLLER_QUORUM_VOTERS", "KAFKA_LISTENERS", "KAFKA_INTER_BROKER_LISTENER_NAME", "KAFKA_CONTROLLER_LISTENER_NAMES"}
        missing_kafka = sorted(required_kafka - set(env))
        if missing_kafka:
            errors.append(f"Kafka HA/security fields are missing: {', '.join(missing_kafka)}")
        errors.extend(_check_kafka(kafka[0]))
        errors.extend(_check_kafka_service_contract(kafka[0], documents))
        if len(kafka[0].get("spec", {}).get("volumeClaimTemplates", [])) != 1:
            errors.append("Kafka persistent storage claim is required")
    elastic = [d for d in documents if d.get("kind") == "StatefulSet" and d.get("metadata", {}).get("name") == "elasticsearch"]
    if len(elastic) != 1:
        errors.append("exactly one rendered Elasticsearch StatefulSet is required")
    else:
        containers = elastic[0].get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
        env = _env(containers[0]) if containers else {}
        if env.get("discovery.type") == "single-node":
            errors.append("Elasticsearch must not use single-node discovery")
        if env.get("xpack.security.enabled", "").lower() != "true":
            errors.append("Elasticsearch security must be enabled")
        if env.get("xpack.security.http.ssl.enabled", "").lower() != "true":
            errors.append("Elasticsearch HTTPS security must be enabled")
        if env.get("xpack.security.transport.ssl.enabled", "").lower() != "true":
            errors.append("Elasticsearch transport TLS must be enabled")
        if "master" not in {role.strip() for role in env.get("node.roles", "").split(",")}:
            errors.append("Elasticsearch role matrix must include master eligibility")
        if elastic[0].get("spec", {}).get("replicas") != 3 or len(elastic[0].get("spec", {}).get("volumeClaimTemplates", [])) != 1:
            errors.append("Elasticsearch HA replicas and persistent storage are required")
    names = {(d.get("kind"), d.get("metadata", {}).get("name")) for d in documents}
    required_authority_objects = {
        ("ConfigMap", "kafka-config"),
        ("ConfigMap", "elasticsearch-security-contract"),
        ("PodDisruptionBudget", "kafka"),
        ("PodDisruptionBudget", "elasticsearch"),
        ("NetworkPolicy", "default-deny"),
        ("NetworkPolicy", "elasticsearch-default-deny"),
    }
    for kind, name in sorted(required_authority_objects - names):
        errors.append(f"canonical authority object is missing: {kind}/{name}")
    if ("CronJob", "db-backup") in names:
        errors.append("legacy backup CronJob is rendered")
    if ("CronJob", "vnshop-authoritative-backup") not in names:
        errors.append("authoritative backup CronJob is missing")
    return sorted(set(errors))


def check(documents: list[dict], *, authority: str | None = None, manifest_sha256: str | None = None) -> list[str]:
    """Validate documents only when they equal the authenticated production render."""
    if authority != "kubectl-kustomize:infra/k8s/overlays/prod" or not isinstance(manifest_sha256, str) or len(manifest_sha256) != 64:
        return ["topology checks require canonical production render authority and digest"]
    rendered = subprocess.run(["kubectl", "kustomize", str(CANONICAL_OVERLAY), "--load-restrictor", "LoadRestrictionsNone"], cwd=ROOT, capture_output=True, check=False)
    if rendered.returncode:
        return ["canonical production render is unavailable"]
    if hashlib.sha256(rendered.stdout).hexdigest() != manifest_sha256:
        return ["topology manifest digest does not match canonical production render"]
    canonical = [doc for doc in yaml.safe_load_all(rendered.stdout) if isinstance(doc, dict)]
    if documents != canonical:
        return ["topology documents are not byte-bound to canonical production render"]
    return _check_documents(canonical)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--inventory", type=Path)
    args = parser.parse_args()
    try:
        if args.inventory:
            payload = json.loads(args.inventory.read_text(encoding="utf-8"))
            if payload.get("authority") != "kubectl-kustomize:infra/k8s/overlays/prod":
                raise ValueError("inventory authority is not canonical production Kustomize")
            if payload.get("status") != "PASS" or payload.get("errors"):
                errors = list(payload.get("errors", [])) or ["inventory status is not PASS"]
            else:
                expected_raw = subprocess.run(["kubectl", "kustomize", str(CANONICAL_OVERLAY), "--load-restrictor", "LoadRestrictionsNone"], cwd=ROOT, capture_output=True, check=False)
                if expected_raw.returncode:
                    raise RuntimeError(expected_raw.stderr.decode("utf-8", errors="replace"))
                expected_sha = __import__("hashlib").sha256(expected_raw.stdout).hexdigest()
                if payload.get("manifest_sha256") != expected_sha:
                    raise ValueError("inventory manifest digest does not match canonical render")
                documents = [doc for doc in yaml.safe_load_all(expected_raw.stdout) if isinstance(doc, dict)]
                if payload.get("resource_count") != len(documents):
                    raise ValueError("inventory resource count does not match canonical render")
                expected_resources = sorted((doc.get("kind"), doc.get("metadata", {}).get("name"), doc.get("metadata", {}).get("namespace", "")) for doc in documents)
                actual_resources = sorted((item.get("kind"), item.get("name"), item.get("namespace", "")) for item in payload.get("resources", []))
                if actual_resources != expected_resources:
                    raise ValueError("inventory resource identities do not match canonical render")
                errors = check(documents, authority=payload.get("authority"), manifest_sha256=payload.get("manifest_sha256"))
        else:
            manifest = args.manifest
            if not manifest:
                rendered = subprocess.run(["kubectl", "kustomize", str(ROOT / "infra/k8s/overlays/prod"), "--load-restrictor", "LoadRestrictionsNone"], cwd=ROOT, capture_output=True, check=False)
                if rendered.returncode:
                    raise RuntimeError(rendered.stderr.decode("utf-8", errors="replace"))
                raw = rendered.stdout
            else:
                canonical = subprocess.run(["kubectl", "kustomize", str(ROOT / "infra/k8s/overlays/prod"), "--load-restrictor", "LoadRestrictionsNone"], cwd=ROOT, capture_output=True, check=False)
                if canonical.returncode:
                    raise RuntimeError(canonical.stderr.decode("utf-8", errors="replace"))
                raw = canonical.stdout
                if manifest.read_bytes() != raw:
                    raise ValueError("supplied manifest is not byte-identical to canonical production render")
            documents = [doc for doc in yaml.safe_load_all(raw) if isinstance(doc, dict)]
            errors = check(documents, authority="kubectl-kustomize:infra/k8s/overlays/prod", manifest_sha256=hashlib.sha256(raw).hexdigest())
    except (OSError, RuntimeError, ValueError, yaml.YAMLError) as exc:
        print(json.dumps({"status": "BLOCKED_EXTERNAL", "errors": [str(exc)]}, sort_keys=True))
        return 1
    result = {"schema_version": "k8s-topology-contract.v1", "status": "PASS" if not errors else "FAIL", "errors": errors}
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())

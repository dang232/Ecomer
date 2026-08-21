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
WORKLOADS = Path(__file__).resolve().parents[2] / "infra/k8s/base/workloads.yaml"


def _extract_topic_entries(script: str) -> set[tuple[str, int]]:
    return {
        (match.group(1), int(match.group(2)))
        for match in re.finditer(r'^\s+"([^":]+):(\d+)"$', script, re.MULTILINE)
    }


def _extract_acl_commands(script: str) -> list[str]:
    lines = script.splitlines()
    commands: list[str] = []
    arrays: dict[str, list[str]] = {}
    current_array: str | None = None
    for line in lines:
        stripped = line.strip()
        array_start = re.match(r"(\w+)=\(\s*$", stripped)
        if array_start:
            current_array = array_start.group(1)
            arrays[current_array] = []
            continue
        if current_array and stripped == ")":
            current_array = None
            continue
        if current_array:
            value = re.fullmatch(r'"([^"]+)"', stripped)
            if value:
                arrays[current_array].append(value.group(1))
        if "$ACL --add" in stripped:
            commands.append(" ".join(stripped.split()))

    expanded: list[str] = []
    active_loop: str | None = None
    for line in lines:
        stripped = line.strip()
        loop = re.match(r'for topic in "\$\{(\w+)\[@\]\}"; do', stripped)
        if loop:
            active_loop = loop.group(1)
            continue
        if active_loop and stripped == "done":
            active_loop = None
            continue
        if "$ACL --add" not in stripped:
            continue
        command = " ".join(stripped.split())
        if ' --topic "$topic"' in command and active_loop:
            expanded.extend(command.replace(' --topic "$topic"', f" --topic {topic}") for topic in arrays.get(active_loop, []))
        elif ' --topic "$topic"' not in command:
            expanded.append(command)
    return expanded


def _extract_acl_entries(script: str) -> set[tuple[str, str, str, str, str]]:
    entries: set[tuple[str, str, str, str, str]] = set()
    for command in _extract_acl_commands(script):
        principal = re.search(r"--allow-principal\s+(\S+)", command)
        operation = re.search(r"--operation\s+(\S+)", command)
        resource = re.search(r"--(topic|group|transactional-id)\s+(\S+)", command)
        if not principal or not operation or not resource:
            continue
        resource_type, resource_name = resource.groups()
        pattern = re.search(r"--resource-pattern-type\s+(\S+)", command)
        entries.add((principal.group(1), operation.group(1), resource_type, resource_name, pattern.group(1) if pattern else "literal"))
    return entries


def _extract_kubernetes_script(document: str) -> str:
    marker = "  init-kafka-topics.sh: |\n"
    start = document.index(marker) + len(marker)
    end = document.index("\n---\napiVersion: batch/v1", start)
    return "\n".join(line[4:] if line.startswith("    ") else line for line in document[start:end].splitlines()) + "\n"


def validate_bootstrap_authority(document: dict, script: str) -> list[str]:
    inventory_topics = {(topic["name"], int(topic["partitions"])) for topic in document.get("topics", [])}
    commands = _extract_acl_commands(script)
    errors = [] if _extract_topic_entries(script) == inventory_topics else ["bootstrap topic metadata must exactly match inventory"]
    declared = {
        (entry["principal"], entry["operation"], entry["resource_type"], entry["resource_name"], entry.get("pattern_type", "literal"))
        for entry in document.get("acl_entries", [])
    }
    actual = _extract_acl_entries(script)
    if len(actual) != len(commands):
        errors.append("bootstrap ACL contains malformed command")
    if len(commands) != len(set(commands)):
        errors.append("bootstrap ACL contains duplicate command")
    if actual != declared or len(declared) != len(document.get("acl_entries", [])):
        errors.append("bootstrap ACL semantics must exactly match inventory")
    if len(document.get("acl_entries", [])) != len({tuple(entry.items()) for entry in document.get("acl_entries", [])}):
        errors.append("inventory ACL entries must be unique")
    return errors


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
    if _extract_acl_entries(kubernetes) != {
        (entry["principal"], entry["operation"], entry["resource_type"], entry["resource_name"], entry.get("pattern_type", "literal"))
        for entry in document.get("acl_entries", [])
    }:
        errors.append("Kubernetes bootstrap ACL semantics must exactly match inventory")
    return errors


def _validate_workload_tls_bindings(document: dict, manifest: str) -> list[str]:
    errors: list[str] = []
    workloads = [doc for doc in yaml.safe_load_all(manifest) if isinstance(doc, dict)]
    deployments = {
        doc.get("metadata", {}).get("labels", {}).get("vnshop.io/artifact-id"): doc
        for doc in workloads if doc.get("kind") == "Deployment"
    }
    java_tls = {entry["service"]: entry for entry in document.get("java_tls", [])}
    for client in document.get("clients", []):
        service = client.get("service")
        if service == "kafka-admin-bootstrap":
            continue
        workload = deployments.get(service)
        if workload is None:
            errors.append(f"Kafka client workload is missing: {service}")
            continue
        pod = workload.get("spec", {}).get("template", {}).get("spec", {})
        container = next(iter(pod.get("containers", [])), {})
        env = {item.get("name"): item for item in container.get("env", [])}
        if client.get("tls_format") == "PEM":
            prefix = "MODERATOR_" if service == "video-moderator" else ""
            volume_name = "kafka-client-tls" if service == "video-moderator" else "kafka-tls"
            expected = {
                f"{prefix}KAFKA_SSL_CA_FILE": (client["ca_secret"], "ca.crt"),
                f"{prefix}KAFKA_SSL_CERT_FILE": (client["client_cert_secret"], "client.crt"),
                f"{prefix}KAFKA_SSL_KEY_FILE": (client["client_key_secret"], "client.key"),
            }
        else:
            tls = java_tls.get(service, {})
            volume_name = "kafka-tls"
            expected = {
                "KAFKA_SSL_TRUSTSTORE_LOCATION": (tls.get("truststore_secret"), "ca.truststore.jks"),
                "KAFKA_SSL_KEYSTORE_LOCATION": (tls.get("keystore_secret"), "client.keystore.jks"),
            }
            for password_name, secret_name in (("KAFKA_SSL_TRUSTSTORE_PASSWORD", "truststore_password_secret"), ("KAFKA_SSL_KEYSTORE_PASSWORD", "keystore_password_secret")):
                if not env.get(password_name, {}).get("valueFrom", {}).get("secretKeyRef", {}).get("key") == tls.get(secret_name):
                    errors.append(f"workload {service} has invalid JKS password binding: {password_name}")
        mounts = [mount for mount in pod.get("containers", [])[0].get("volumeMounts", []) if mount.get("name") == volume_name]
        if len(mounts) != 1 or mounts[0].get("mountPath") != "/etc/kafka/tls":
            errors.append(f"workload {service} has invalid TLS mount")
        volumes = [volume for volume in pod.get("volumes", []) if volume.get("name") == volume_name]
        if len(volumes) != 1:
            errors.append(f"workload {service} has invalid TLS volume")
            continue
        secret = volumes[0].get("secret", {})
        if secret.get("secretName") != "vnshop-runtime-secrets":
            errors.append(f"workload {service} has invalid TLS Secret source")
        actual_items = {item.get("key"): item.get("path") for item in secret.get("items", [])}
        for env_name, (secret_key, path) in expected.items():
            if env.get(env_name, {}).get("value") != f"/etc/kafka/tls/{path}":
                errors.append(f"workload {service} has invalid TLS path: {env_name}")
            if actual_items.get(secret_key) != path:
                errors.append(f"workload {service} has invalid TLS Secret item: {secret_key}")
    return errors


def _validate_broker_auth_source(document: dict, manifest: str, migration: str | None = None) -> list[str]:
    errors: list[str] = []
    if "listener.name.client.plain.sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required;" in manifest:
        errors.append("broker CLIENT PLAIN JAAS source is empty")
    if "export KAFKA_OPTS=" not in manifest or "java.security.auth.login.config" not in manifest:
        errors.append("broker must load an external generated JAAS source")
    if "emptyDir:" not in manifest or "medium: Memory" not in manifest:
        errors.append("broker JAAS workspace must be memory-backed")
    if "umask 077" not in manifest:
        errors.append("broker JAAS generation must set umask 077")
    if "client.KafkaServer" not in manifest:
        errors.append("broker JAAS must use the listener-scoped client.KafkaServer section")
    if re.search(r"listener\.name\.client\.plain\.sasl\.jaas\.config\s*=", manifest):
        errors.append("broker must not override static listener-scoped JAAS with an inline CLIENT property")
    if re.search(r'user_[A-Za-z0-9._-]+\s*=\s*"', manifest):
        errors.append("broker manifest must not contain literal JAAS credentials")
    principals = {client.get("principal") for client in document.get("clients", [])}
    username_keys = {client.get("username_secret") for client in document.get("clients", [])}
    password_keys = {client.get("password_secret") for client in document.get("clients", [])}
    try:
        broker_documents = [doc for doc in yaml.safe_load_all(manifest.lstrip("\ufeff")) if isinstance(doc, dict)]
        broker_statefulset = next(doc for doc in broker_documents if doc.get("kind") == "StatefulSet")
        broker_pod = broker_statefulset["spec"]["template"]["spec"]
        credential_volumes = [volume for volume in broker_pod.get("volumes", []) if volume.get("name") == "kafka-credentials"]
        credential_items = [item for volume in credential_volumes for item in volume.get("secret", {}).get("items", [])]
    except (StopIteration, KeyError, TypeError, yaml.YAMLError):
        credential_items = []
    expected_paths: dict[str, str] = {}
    for client in document.get("clients", []):
        principal = client.get("principal")
        if principal in expected_paths:
            errors.append(f"broker credential principals must be unique: {principal}")
        expected_paths[client.get("username_secret")] = f"{principal}.username"
        expected_paths[client.get("password_secret")] = f"{principal}.password"
    for key in sorted(username_keys | password_keys):
        matches = [item for item in credential_items if item.get("key") == key]
        if not key or len(matches) != 1:
            errors.append(f"broker credential Secret key must be represented exactly once: {key}")
        elif matches[0].get("path") != expected_paths.get(key):
            errors.append(f"broker credential Secret key has wrong principal-derived path: {key}")
    if len(credential_items) != len(username_keys | password_keys):
        errors.append("broker credential Secret projection contains duplicate or extra mappings")
    projected_paths = [item.get("path") for item in credential_items]
    if len(projected_paths) != len(set(projected_paths)):
        errors.append("broker credential Secret projection contains duplicate paths")
    if len(principals) != len(document.get("clients", [])):
        errors.append("broker credential principals must be unique")
    if migration is not None:
        try:
            migration_document = yaml.safe_load(migration)
            certificate = migration_document.get("certificate_contract", {})
            mapping = certificate.get("principal_mapping", {})
            expected_mapping = "RULE:^CN=(kafka-node),O=VNShop$/$1/,DEFAULT"
            if mapping.get("rules") != expected_mapping:
                errors.append("certificate principal mapping rules are not exact and fail-closed")
            subject = certificate.get("subject_dn_contract", {})
            if subject.get("node") != "CN=kafka-node,O=VNShop":
                errors.append("combined Kafka node certificate subject is incomplete")
            if mapping.get("controller_principal") != "kafka-node" or mapping.get("broker_principal") != "kafka-node":
                errors.append("certificate principal mapping identities are incomplete")
            if set(subject.get("application_forbidden_principals", [])) != {"kafka-node", "kafka-admin"}:
                errors.append("application certificate principal exclusions are incomplete")
            if "server.properties" in next(doc for doc in broker_documents if doc.get("kind") == "ConfigMap").get("data", {}):
                errors.append("Kafka ConfigMap must not own broker server.properties")
            if "KAFKA_SASL_MECHANISM_INTER_BROKER_PROTOCOL" in manifest:
                errors.append("SSL-only INTERNAL listener must not declare an inter-broker SASL mechanism")
            if "User:kafka-node;User:kafka-admin" not in manifest:
                errors.append("Kafka super-users do not match combined node certificate principal")
            certificate_contract = certificate
            admin_keystore_key = certificate_contract.get("admin_keystore_secret_key")
            statefulset = next(doc for doc in broker_documents if doc.get("kind") == "StatefulSet")
            pod_spec = statefulset["spec"]["template"]["spec"]
            if statefulset.get("spec", {}).get("podManagementPolicy") != "Parallel":
                errors.append("Kafka podManagementPolicy must be exactly Parallel")
            tls_volumes = [volume for volume in pod_spec.get("volumes", []) if volume.get("name") == "kafka-tls"]
            tls_items = [item for volume in tls_volumes for item in volume.get("secret", {}).get("items", [])]
            expected_tls = {
                "platform-kafka-broker-keystore": "broker.keystore.jks",
                admin_keystore_key: "admin.keystore.jks",
                "platform-kafka-truststore": "ca.truststore.jks",
                "platform-kafka-admin-client-properties": "admin.properties",
            }
            for secret_key, path in expected_tls.items():
                matches = [item for item in tls_items if item.get("key") == secret_key and item.get("path") == path]
                if len(matches) != 1:
                    errors.append(f"Kafka TLS Secret mapping must contain exactly one {secret_key} -> {path}")
            if len({item.get("path") for item in tls_items}) != len(tls_items):
                errors.append("Kafka TLS Secret mappings must have unique paths")
            if len({item.get("key") for item in tls_items}) != len(tls_items):
                errors.append("Kafka TLS Secret mappings must have unique keys")
            try:
                runtime_env = next(doc for doc in broker_documents if doc.get("kind") == "StatefulSet")["spec"]["template"]["spec"]["containers"][0].get("env", [])
                pod_spec = next(doc for doc in broker_documents if doc.get("kind") == "StatefulSet")["spec"]["template"]["spec"]
                if pod_spec.get("enableServiceLinks") is not False:
                    errors.append("Kafka pod enableServiceLinks must be exactly false")
                env_names = [entry.get("name") for entry in runtime_env if isinstance(entry, dict)]
                if len(env_names) != len(set(env_names)):
                    errors.append("Kafka main container environment contains duplicate names")
                deprecated_names = {"KAFKA_PORT", "KAFKA_ADVERTISED_PORT", "KAFKA_HOST", "KAFKA_ADVERTISED_HOST"}
                if deprecated_names & set(env_names):
                    errors.append("Kafka main container contains deprecated service-link environment variables")
                cluster_bindings = [entry for entry in runtime_env if entry.get("name") == "CLUSTER_ID"]
                if len(cluster_bindings) != 1 or cluster_bindings[0].get("valueFrom", {}).get("secretKeyRef") != {"name": "vnshop-runtime-secrets", "key": "platform-kafka-cluster-id"} or any(entry.get("name") == "KAFKA_CLUSTER_ID" for entry in runtime_env):
                    errors.append("Kafka main container must use the documented CLUSTER_ID Secret binding")
                init = next(doc for doc in broker_documents if doc.get("kind") == "StatefulSet")["spec"]["template"]["spec"]["initContainers"][0]
                init_cluster_bindings = [entry for entry in init.get("env", []) if entry.get("name") == "CLUSTER_ID"]
                if len(init_cluster_bindings) != 1 or init_cluster_bindings[0].get("valueFrom", {}).get("secretKeyRef") != {"name": "vnshop-runtime-secrets", "key": "platform-kafka-cluster-id"}:
                    errors.append("Kafka init container must share the documented CLUSTER_ID Secret binding")
                runtime_values = {entry.get("name"): entry.get("value") for entry in runtime_env if isinstance(entry, dict)}
                init_properties: dict[str, str] = {}
                init_script = "\n".join(init.get("args", []))
                properties_match = re.search(r"cat > /run/kafka-init/server\.properties <<EOF\n(?P<properties>.*?)\n\s*EOF", init_script, re.DOTALL)
                if properties_match:
                    for line in properties_match.group("properties").splitlines():
                        key, separator, value = line.strip().partition("=")
                        if separator:
                            init_properties[key] = value
                if runtime_values.get("KAFKA_CONTROLLER_QUORUM_VOTERS") != init_properties.get("controller.quorum.voters"):
                    errors.append("runtime quorum voters must equal init KRaft voters")
                if runtime_values.get("KAFKA_LISTENERS") != init_properties.get("listeners"):
                    errors.append("runtime listeners must equal init KRaft listeners")
                init_advertised = init_properties.get("advertised.listeners", "")
                main_advertised = runtime_values.get("KAFKA_ADVERTISED_LISTENERS", "")
                expected_init_advertised = "CLIENT://kafka:9092,INTERNAL://kafka-$ordinal.kafka-headless:9094"
                expected_main_advertised = "CLIENT://kafka:9092,INTERNAL://$(POD_NAME).kafka-headless:9094"
                if init_advertised != expected_init_advertised:
                    errors.append("Kafka init advertised listeners must use CLIENT service DNS and ordinal headless DNS")
                if main_advertised != expected_main_advertised:
                    errors.append("Kafka main advertised listeners must use CLIENT service DNS and POD_NAME headless DNS")
                unsafe_advertised_tokens = ("0.0.0.0", "localhost", "127.0.0.1", "::")
                if not init_advertised or not main_advertised:
                    errors.append("Kafka init and main advertised listeners are required")
                if any(token in init_advertised.lower() or token in main_advertised.lower() for token in unsafe_advertised_tokens):
                    errors.append("Kafka advertised listeners must use routable endpoints")
                if "CONTROLLER://" in init_advertised or "CONTROLLER://" in main_advertised:
                    errors.append("Kafka advertised listeners must not include CONTROLLER")
                normalized_init_advertised = init_advertised.replace("kafka-$ordinal", "$(POD_NAME)")
                if normalized_init_advertised != main_advertised:
                    errors.append("Kafka init and main advertised listeners must have semantic template parity")
                parity_values = {
                    "KAFKA_PROCESS_ROLES": "process.roles",
                    "KAFKA_CONTROLLER_LISTENER_NAMES": "controller.listener.names",
                    "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP": "listener.security.protocol.map",
                    "KAFKA_INTER_BROKER_LISTENER_NAME": "inter.broker.listener.name",
                    "KAFKA_LOG_DIRS": "log.dirs",
                }
                for runtime_key, init_key in parity_values.items():
                    expected_value = init_properties.get(init_key)
                    if runtime_values.get(runtime_key) != expected_value:
                        errors.append(f"runtime {runtime_key} must equal init {init_key}")
                if runtime_values.get("KAFKA_SUPER_USERS") != "User:kafka-node;User:kafka-admin":
                    errors.append("runtime Kafka super-users do not match combined node principal")
                critical_values = {
                    "KAFKA_DEFAULT_REPLICATION_FACTOR": "3",
                    "KAFKA_MIN_INSYNC_REPLICAS": "2",
                    "KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR": "3",
                    "KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR": "3",
                    "KAFKA_TRANSACTION_STATE_LOG_MIN_ISR": "2",
                    "KAFKA_UNCLEAN_LEADER_ELECTION_ENABLE": "false",
                    "KAFKA_NUM_PARTITIONS": "6",
                    "KAFKA_LOG_RETENTION_HOURS": "168",
                    "KAFKA_LOG_DIRS": "/var/lib/kafka/data",
                    "KAFKA_LISTENER_NAME_CLIENT_SASL_ENABLED_MECHANISMS": "PLAIN",
                    "KAFKA_LISTENER_NAME_CLIENT_SSL_CLIENT_AUTH": "required",
                    "KAFKA_LISTENER_NAME_INTERNAL_SSL_CLIENT_AUTH": "required",
                    "KAFKA_LISTENER_NAME_CONTROLLER_SSL_CLIENT_AUTH": "required",
                    "KAFKA_SSL_KEYSTORE_LOCATION": "/etc/kafka/tls/broker.keystore.jks",
                    "KAFKA_SSL_TRUSTSTORE_LOCATION": "/etc/kafka/tls/ca.truststore.jks",
                    "KAFKA_SSL_PRINCIPAL_MAPPING_RULES": expected_mapping,
                }
                if any(runtime_values.get(key) != value for key, value in critical_values.items()):
                    errors.append("runtime SSL principal mapping does not match migration contract")
                if "KAFKA_SSL_KEYSTORE_FILENAME" in runtime_values or "KAFKA_SSL_TRUSTSTORE_FILENAME" in runtime_values:
                    errors.append("runtime Kafka SSL filename variables are forbidden")
                container_mounts = runtime_env = next(doc for doc in broker_documents if doc.get("kind") == "StatefulSet")["spec"]["template"]["spec"]["containers"][0].get("volumeMounts", [])
                if any(mount.get("subPath") == "server.properties" for mount in container_mounts):
                    errors.append("Kafka container must not mount a divergent server.properties")
                init = next(doc for doc in broker_documents if doc.get("kind") == "StatefulSet")["spec"]["template"]["spec"]["initContainers"][0]
                init_script = "\n".join(init.get("args", []))
                required_init = ("node.id=$ordinal", "controller.quorum.voters=", "controller.listener.names=CONTROLLER", "listener.security.protocol.map=CLIENT:SASL_SSL,CONTROLLER:SSL,INTERNAL:SSL", "log.dirs=/var/lib/kafka/data", "kafka-storage format --config /run/kafka-init/server.properties")
                if any(marker not in init_script for marker in required_init):
                    errors.append("KRaft init formatting contract is incomplete")
                for probe_name in ("readinessProbe", "livenessProbe", "startupProbe"):
                    command_text = " ".join(statefulset["spec"]["template"]["spec"]["containers"][0].get(probe_name, {}).get("exec", {}).get("command", []))
                    for path in ("/etc/kafka/tls/ca.truststore.jks", "/etc/kafka/tls/admin.keystore.jks", "/etc/kafka/tls/admin.properties"):
                        if path not in command_text:
                            errors.append(f"Kafka {probe_name} must check/read {path}")
            except (StopIteration, KeyError, TypeError):
                errors.append("Kafka runtime security environment is unavailable")
            broker_documents = [doc for doc in yaml.safe_load_all(manifest.lstrip("\ufeff")) if isinstance(doc, dict)]
            statefulset = next(doc for doc in broker_documents if doc.get("kind") == "StatefulSet")
            init_runtime = [volume for volume in statefulset["spec"]["template"]["spec"].get("volumes", []) if volume.get("name") == "kafka-init-runtime"]
            if len(init_runtime) != 1 or init_runtime[0].get("emptyDir", {}).get("medium") != "Memory":
                errors.append("KRaft init workspace must be memory-backed")
            tls_items = [item for volume in tls_volumes for item in volume.get("secret", {}).get("items", []) if item.get("key") == "platform-kafka-broker-keystore"]
            if len(tls_items) != 1:
                errors.append("combined node certificate must have exactly one broker keystore source")
        except (AttributeError, TypeError, yaml.YAMLError):
            errors.append("certificate principal mapping contract is unavailable")
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
    expected_identities = {"order-service", "payment-service", "inventory-service", "product-service", "shipping-service", "search-service", "recommendations-service", "seller-finance-service", "notification-service", "messaging-service", "invoice-service", "user-service", "video-transcoder", "video-moderator", "kafka-admin-bootstrap"}
    if not isinstance(clients, list) or {client.get("service") for client in clients} != expected_identities:
        errors.append("inventory clients must cover 14 application identities and kafka-admin-bootstrap")
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
            if client.get("tls_format") not in {"JKS", "PEM"}:
                errors.append(f"client {service} has invalid tls_format")
    java_tls = document.get("java_tls")
    expected_java_services = {"order-service", "payment-service", "inventory-service", "product-service", "shipping-service", "search-service", "recommendations-service", "seller-finance-service", "invoice-service", "user-service", "video-transcoder"}
    if not isinstance(java_tls, list) or {entry.get("service") for entry in java_tls if entry.get("service") != "kafka-admin-bootstrap"} != expected_java_services:
        errors.append("java_tls must cover every Java Kafka workload")
    else:
        for entry in java_tls:
            if entry.get("service") == "kafka-admin-bootstrap":
                continue
            for field in ("truststore_secret", "keystore_secret", "truststore_password_secret", "keystore_password_secret"):
                if not entry.get(field):
                    errors.append(f"Java TLS entry {entry.get('service')} missing {field}")
    inventory_topics = {topic["name"] for topic in topics} if isinstance(topics, list) else set()
    if script_topics != inventory_topics:
        errors.append("local bootstrap topic list must exactly match inventory")
    errors.extend(validate_bootstrap_authority(document, script))
    try:
        errors.extend(_validate_workload_tls_bindings(document, WORKLOADS.read_text(encoding="utf-8-sig")))
    except (OSError, TypeError, ValueError, yaml.YAMLError) as exc:
        errors.append(f"Kafka workload authority unavailable: {exc}")
    try:
        broker_manifest = (BOOTSTRAP_SCRIPT.parent.parent / "k8s/kafka/kafka-statefulset.yaml").read_text(encoding="utf-8")
        migration_manifest = MIGRATION_CONTRACT.read_text(encoding="utf-8")
        errors.extend(_validate_broker_auth_source(document, broker_manifest, migration_manifest))
    except OSError as exc:
        errors.append(f"Kafka broker authority unavailable: {exc}")
    try:
        manifest = (BOOTSTRAP_SCRIPT.parent.parent / "k8s/base/kafka-bootstrap-job.yaml").read_text(encoding="utf-8")
        errors.extend(validate_kubernetes_bootstrap_authority(document, manifest))
    except OSError as exc:
        errors.append(f"Kubernetes bootstrap authority unavailable: {exc}")
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

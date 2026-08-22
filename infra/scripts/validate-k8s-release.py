#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse
import ipaddress

import yaml


REPO = Path(__file__).resolve().parents[2]
DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
ZERO_DIGEST = "sha256:" + ("0" * 64)
ATTESTATION_ID = re.compile(r"^(?:https://|oci://|registry://|rekor://|sigstore://)[^\s]+$")
REQUIRED_ENVIRONMENT = {
    "cart-service": {
        "PORT", "DATABASE_URL", "REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD",
        "PRODUCT_SERVICE_URL",
    },
    "messaging-service": {
        "PORT", "DB_HOST", "DB_PORT", "DB_DATABASE", "DB_USERNAME", "DB_PASSWORD",
        "KAFKA_BOOTSTRAP_SERVERS", "KAFKA_SASL_USERNAME", "KAFKA_SASL_PASSWORD",
    },
    "monitoring-service-v2": {
        "PORT", "TIMESCALE_HOST", "TIMESCALE_PORT", "TIMESCALE_DB",
        "TIMESCALE_USER", "TIMESCALE_PASSWORD",
    },
    "notification-service": {
        "PORT", "MONGO_URI", "REDIS_URL", "KAFKA_BOOTSTRAP_SERVERS",
        "KAFKA_SASL_USERNAME", "KAFKA_SASL_PASSWORD",
    },
    "order-service": {
        "GRPC_CLIENT_INVENTORY_HOST", "GRPC_CLIENT_INVENTORY_PORT",
        "GRPC_CLIENT_PAYMENT_HOST", "GRPC_CLIENT_PAYMENT_PORT",
        "GRPC_CLIENT_SHIPPING_HOST", "GRPC_CLIENT_SHIPPING_PORT",
    },
    "product-service": {
        "VNSHOP_OBJECT_STORAGE_ENABLED", "VNSHOP_OBJECT_STORAGE_ENDPOINT",
        "VNSHOP_OBJECT_STORAGE_PUBLIC_ENDPOINT", "VNSHOP_OBJECT_STORAGE_BUCKET",
        "VNSHOP_OBJECT_STORAGE_ACCESS_KEY", "VNSHOP_OBJECT_STORAGE_SECRET_KEY",
    },
    "search-service": {"ELASTICSEARCH_HOST", "ELASTICSEARCH_PORT", "ELASTIC_PASSWORD"},
    "user-service": {
        "KEYCLOAK_ADMIN_BASE_URL", "KEYCLOAK_PUBLIC_BASE_URL",
        "KEYCLOAK_ADMIN_CLIENT_SECRET", "VNSHOP_FRONTEND_URL",
        "VNSHOP_AUTH_CALLBACK_BASE_URL", "VNSHOP_USER_STORAGE_ENABLED",
        "VNSHOP_USER_STORAGE_ENDPOINT", "VNSHOP_USER_STORAGE_PUBLIC_ENDPOINT",
        "VNSHOP_USER_STORAGE_BUCKET", "VNSHOP_USER_STORAGE_ACCESS_KEY",
        "VNSHOP_USER_STORAGE_SECRET_KEY",
    },
    "video-moderator": {
        "MODERATOR_PORT", "MODERATOR_DATABASE_URL", "MODERATOR_KAFKA_BOOTSTRAP_SERVERS",
        "MODERATOR_KAFKA_SECURITY_PROTOCOL", "MODERATOR_KAFKA_SASL_MECHANISM",
        "MODERATOR_KAFKA_SASL_USERNAME", "MODERATOR_KAFKA_SASL_PASSWORD",
        "MODERATOR_STORAGE_ENDPOINT", "MODERATOR_STORAGE_ACCESS_KEY",
        "MODERATOR_STORAGE_SECRET_KEY",
    },
    "video-transcoder": {
        "SERVER_PORT", "KAFKA_BOOTSTRAP_SERVERS", "KAFKA_SASL_USERNAME",
        "KAFKA_SASL_PASSWORD", "S3_ENDPOINT", "S3_REGION", "S3_ACCESS_KEY",
        "S3_SECRET_KEY",
    },
}

OPTIONAL_PROVIDER_SECRET_FLAGS = {
    "payment-vietqr-account-no": "VIETQR_ENABLED",
    "payment-vietqr-account-name": "VIETQR_ENABLED",
    "payment-vnpay-tmn-code": "VNPAY_ENABLED",
    "payment-vnpay-hash-secret": "VNPAY_ENABLED",
    "payment-momo-partner-code": "MOMO_ENABLED",
    "payment-momo-access-key": "MOMO_ENABLED",
    "payment-momo-secret-key": "MOMO_ENABLED",
    "payment-stripe-secret-key": "STRIPE_ENABLED",
    "payment-stripe-publishable-key": "STRIPE_ENABLED",
    "payment-stripe-webhook-secret": "STRIPE_ENABLED",
    "payment-paypal-client-id": "PAYPAL_ENABLED",
    "payment-paypal-client-secret": "PAYPAL_ENABLED",
}

PROVIDER_SECRET_KEYS = {
    "VIETQR_ENABLED": {"payment-vietqr-account-no", "payment-vietqr-account-name"},
    "VNPAY_ENABLED": {"payment-vnpay-tmn-code", "payment-vnpay-hash-secret"},
    "MOMO_ENABLED": {"payment-momo-partner-code", "payment-momo-access-key", "payment-momo-secret-key"},
    "STRIPE_ENABLED": {"payment-stripe-secret-key", "payment-stripe-publishable-key", "payment-stripe-webhook-secret"},
    "PAYPAL_ENABLED": {"payment-paypal-client-id", "payment-paypal-client-secret"},
}


def collect_required_secret_keys(documents: list[dict], app_config_data: dict) -> set[str]:
    """Return runtime Secret keys required by the rendered provider configuration.

    Optional payment-provider refs are deliberately present in every rendered
    workload. They only become a release requirement when the corresponding
    method is enabled in vnshop-app-config.
    """
    required: set[str] = set()

    def collect(value):
        if isinstance(value, dict):
            reference = value.get("secretKeyRef")
            if isinstance(reference, dict) and reference.get("name") == "vnshop-runtime-secrets":
                key = reference.get("key", "")
                if not reference.get("optional", False):
                    required.add(key)
                else:
                    flag = OPTIONAL_PROVIDER_SECRET_FLAGS.get(key)
                    if flag is None or str(app_config_data.get(flag, "false")).lower() == "true":
                        required.add(key)
            secret = value.get("secret")
            if isinstance(secret, dict) and secret.get("secretName") == "vnshop-runtime-secrets":
                required.update(item.get("key", "") for item in secret.get("items", []))
            for nested in value.values():
                collect(nested)
        elif isinstance(value, list):
            for nested in value:
                collect(nested)

    collect(documents)
    required.discard("")
    return required


def collect_secret_references(documents: list[dict]) -> set[str]:
    present: set[str] = set()

    def collect(value):
        if isinstance(value, dict):
            reference = value.get("secretKeyRef")
            if isinstance(reference, dict) and reference.get("name") == "vnshop-runtime-secrets":
                key = reference.get("key")
                if isinstance(key, str) and key:
                    present.add(key)
            for nested in value.values():
                collect(nested)
        elif isinstance(value, list):
            for nested in value:
                collect(nested)

    collect(documents)
    return present


def validate_enabled_provider_secret_refs(
    documents: list[dict], app_config_data: dict, errors: list[str]
) -> None:
    present = collect_secret_references(documents)
    for flag, required in sorted(PROVIDER_SECRET_KEYS.items()):
        if str(app_config_data.get(flag, "false")).lower() != "true":
            continue
        for key in sorted(required - present):
            errors.append(f"enabled provider {flag} is missing SealedSecret reference {key}")


def fail(errors: list[str]) -> None:
    if not errors:
        return
    print("Kubernetes release validation failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)


def validate_production_realm_hosts(environment: str, suffix: str, errors: list[str]) -> None:
    if environment != "prod":
        return
    realm_path = REPO / "infra/keycloak/vnshop-realm-prod.json"
    try:
        realm = json.loads(realm_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        errors.append(f"production Keycloak realm cannot be loaded: {error}")
        return

    expected_hosts = {f"web.{suffix}", f"api.{suffix}"}
    configured_hosts: set[str] = set()
    monitoring_client = None
    client_by_id: dict[str, dict] = {}
    for client in realm.get("clients", []):
        client_by_id[client.get("clientId", "")] = client
        if client.get("clientId") == "vnshop-monitoring":
            monitoring_client = client
        for uri in client.get("redirectUris", []):
            parsed = re.match(r"https://([^/]+)(?:/.*)?$", uri)
            if parsed:
                configured_hosts.add(parsed.group(1))
        for origin in client.get("webOrigins", []):
            parsed = re.match(r"https://([^/]+)$", origin)
            if parsed:
                configured_hosts.add(parsed.group(1))

    if not expected_hosts.issubset(configured_hosts):
        errors.append("production Keycloak realm must authorize the deployed web and API hosts")
    if any(host in {"localhost", "127.0.0.1"} or host.endswith((".example", ".example.com", ".invalid")) for host in configured_hosts):
        errors.append("production Keycloak realm contains placeholder hosts")
    if not monitoring_client:
        errors.append("production Keycloak realm must define the monitoring OIDC client")
    else:
        expected_callback = f"https://api.{suffix}/monitoring/"
        if expected_callback not in monitoring_client.get("redirectUris", []):
            errors.append("monitoring OIDC client must authorize the gateway-served dashboard callback")
        if monitoring_client.get("attributes", {}).get("pkce.code.challenge.method") != "S256":
            errors.append("monitoring OIDC client must require S256 PKCE")
        monitoring_scope = next(
            (mapping for mapping in realm.get("scopeMappings", [])
             if mapping.get("client") == "vnshop-monitoring"),
            None,
        )
        if not monitoring_scope or "ADMIN" not in monitoring_scope.get("roles", []):
            errors.append("monitoring OIDC client must have an explicit ADMIN realm-role scope mapping")

    expected_client_contracts = {
        "vnshop-gateway": {
            f"https://web.{suffix}/login/oauth2/code/vnshop-gateway",
            f"https://api.{suffix}/login/oauth2/code/vnshop-gateway",
        },
        "vnshop-web": {f"https://web.{suffix}/*"},
        "vnshop-api": {f"https://api.{suffix}/*"},
    }
    for client_id, expected_uris in expected_client_contracts.items():
        client = client_by_id.get(client_id)
        if not client:
            errors.append(f"production Keycloak realm must define {client_id}")
            continue
        if not expected_uris.issubset(set(client.get("redirectUris", []))):
            errors.append(f"production Keycloak realm must authorize expected redirect URIs for {client_id}")


def render(environment: str) -> bytes:
    command = ["kubectl", "kustomize", str(REPO / "infra/k8s/overlays" / environment), "--load-restrictor", "LoadRestrictionsNone"]
    result = subprocess.run(command, cwd=REPO, capture_output=True, check=False)
    if result.returncode != 0:
        raise SystemExit(result.stderr.decode("utf-8", errors="replace"))
    return result.stdout


def load_lock(environment: str, errors: list[str]) -> dict | None:
    path = REPO / "infra/release/locks" / f"{environment}.json"
    if not path.exists():
        return None
    try:
        lock = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        errors.append(f"invalid release lock {path}: {error}")
        return None
    return lock


def validate_release_lock_presence(
    environment: str,
    lock: dict | None,
    *,
    allow_unresolved: bool,
    errors: list[str],
) -> None:
    """Require an external release lock unless unresolved dev validation is explicit."""
    if lock is None and not allow_unresolved:
        errors.append(f"missing infra/release/locks/{environment}.json")


def validate_lock(lock: dict, catalog: dict, errors: list[str]) -> dict[str, dict]:
    if not re.fullmatch(r"[0-9a-f]{40}", lock.get("sourceCommit", "")):
        errors.append("release lock sourceCommit must be a full lowercase Git SHA")
    artifacts = lock.get("artifacts")
    if not isinstance(artifacts, list) or len(artifacts) != 19:
        errors.append("release lock must contain exactly 19 artifacts")
        return {}
    by_id = {artifact.get("id"): artifact for artifact in artifacts}
    catalog_by_id = {item["id"]: item for item in catalog["deployables"]}
    if set(by_id) != set(catalog_by_id):
        errors.append("release lock artifact IDs must exactly match infra/deployables.json")
    for artifact_id, artifact in by_id.items():
        expected = catalog_by_id.get(artifact_id)
        if expected and artifact.get("image") != expected["image"]:
            errors.append(f"{artifact_id}: release lock image does not match catalog")
        digest = artifact.get("digest", "")
        if not DIGEST.fullmatch(digest) or digest == ZERO_DIGEST:
            errors.append(f"{artifact_id}: release lock requires a non-placeholder sha256 digest")
        for field in ("sbom", "provenance"):
            if not isinstance(artifact.get(field), str) or not artifact[field] or not _external_uri(artifact[field]):
                errors.append(f"{artifact_id}: {field} evidence URI is required")
        if artifact.get("provenanceVerified") is not True:
            errors.append(f"{artifact_id}: signed provenance must be verified before locking")
        provenance = artifact.get("provenanceRecord")
        if not isinstance(provenance, dict) or not all(provenance.get(field) for field in ("producer", "sourceCommit", "artifactDigest", "attestationId")):
            errors.append(f"{artifact_id}: structured independent provenance record is required")
        elif (
            provenance.get("producer") in {"", "repository", "self"}
            or not isinstance(provenance.get("attestationId"), str)
            or not ATTESTATION_ID.fullmatch(provenance["attestationId"])
            or not re.fullmatch(r"[0-9a-f]{40}", str(provenance.get("sourceCommit", "")))
            or not DIGEST.fullmatch(str(provenance.get("artifactDigest", "")))
        ):
            errors.append(f"{artifact_id}: provenance producer and attestation must be independent")
        elif provenance.get("sourceCommit") != lock.get("sourceCommit") or provenance.get("artifactDigest") != digest:
            errors.append(f"{artifact_id}: provenance identity does not match lock")
    return by_id


def _external_uri(value: str) -> bool:
    """Return whether an evidence URI names an external artifact authority."""
    return bool(re.match(r"^(?:https://|oci://|registry://|rekor://|sigstore://)[^\s]+$", value)) and not any(
        marker in value.lower() for marker in ("repository", "self-authored", "file://")
    )


def _unsafe_origin(origin: str) -> bool:
    """Reject non-HTTPS, local, private, and placeholder origin hosts."""
    parsed = urlparse(origin)
    host = parsed.hostname or ""
    try:
        unsafe_ip = ipaddress.ip_address(host).is_private or ipaddress.ip_address(host).is_loopback or ipaddress.ip_address(host).is_link_local
    except ValueError:
        unsafe_ip = False
    return parsed.scheme != "https" or not host or host == "localhost" or unsafe_ip or host.endswith((".example", ".example.com", ".invalid"))


def is_strict_environment(environment: str) -> bool:
    return environment in {"staging", "prod"}


def validate_release_policy(
    documents: list[dict],
    environment: str,
    *,
    allow_unresolved: bool = False,
    allow_unsealed: bool = False,
) -> list[str]:
    """Validate policies that must not be satisfied by production placeholders."""
    errors: list[str] = []
    strict = is_strict_environment(environment)

    if (allow_unresolved or allow_unsealed) and strict:
        errors.append("--allow-unresolved and --allow-unsealed are only permitted for dev")

    configmaps = [doc for doc in documents if doc.get("kind") == "ConfigMap"]
    app_config = next(
        (doc for doc in configmaps if doc.get("metadata", {}).get("name") == "vnshop-app-config"),
        {},
    )
    app_data = app_config.get("data", {})

    if strict:
        for key, value in app_data.items():
            if not isinstance(value, str):
                continue
            normalized = value.strip()
            lowered = normalized.lower()
            if key.endswith("_MODE") and lowered in {"stub", "demo"}:
                errors.append(f"vnshop-app-config {key} must not use {lowered} mode")
            if key in {"KAFKA_SECURITY_PROTOCOL", "KAFKA_SASL_SECURITY_PROTOCOL"} \
                    and lowered == "sasl_plaintext":
                errors.append("Kafka must not use SASL_PLAINTEXT in staging or prod")
            if key.startswith("ELASTICSEARCH") and lowered.startswith("http://"):
                errors.append(f"vnshop-app-config {key} must use an HTTPS Elasticsearch endpoint")

            if key.endswith("ORIGIN") or key.endswith("ORIGINS") or "PUBLIC_URL" in key \
                    or "CALLBACK_BASE_URL" in key or key == "KEYCLOAK_ISSUER_URI":
                for raw_origin in normalized.split(","):
                    origin = raw_origin.strip()
                    if _unsafe_origin(origin):
                        errors.append(f"vnshop-app-config {key} must not use a placeholder origin")

    for document in documents:
        if document.get("kind") == "Secret":
            if strict or not allow_unsealed:
                errors.append("rendered desired state must not contain plaintext Secret resources")
        pod_spec = document.get("spec", {}).get("template", {}).get("spec")
        if document.get("kind") == "CronJob":
            pod_spec = document.get("spec", {}).get("jobTemplate", {}).get("spec", {}).get("template", {}).get("spec")
        if not isinstance(pod_spec, dict):
            continue
        if document.get("kind") == "StatefulSet" and document.get("metadata", {}).get("name") == "elasticsearch":
            containers = pod_spec.get("containers", [])
            for container in containers:
                values = {entry.get("name"): str(entry.get("value", "")) for entry in container.get("env", [])}
                if strict and values.get("discovery.type") == "single-node":
                    errors.append("Elasticsearch production topology must not use single-node discovery")
                if strict and values.get("xpack.security.enabled", "").lower() != "true":
                    errors.append("Elasticsearch security must be enabled in staging or prod")
                if strict and not any(entry.get("name") in {"ELASTIC_PASSWORD", "ELASTICSEARCH_PASSWORD"} for entry in container.get("env", [])):
                    errors.append("Elasticsearch requires a secret-backed authentication input")
                for entry in container.get("env", []):
                    if entry.get("name") == "xpack.security.enabled" and str(entry.get("value", "")).lower() == "false":
                        if strict:
                            errors.append("Elasticsearch security must be enabled in staging or prod")
        if strict and document.get("kind") == "StatefulSet" and document.get("metadata", {}).get("name") == "kafka":
            values = {entry.get("name"): str(entry.get("value", "")) for entry in pod_spec.get("containers", [])[0].get("env", [])} if pod_spec.get("containers") else {}
            if values.get("KAFKA_LISTENERS", "").lower().find("plaintext") >= 0 or values.get("KAFKA_ADVERTISED_LISTENERS", "").lower().find("plaintext") >= 0:
                errors.append("Kafka production listeners must not use plaintext")
            if "SASL_SSL" not in values.get("KAFKA_LISTENER_SECURITY_PROTOCOL_MAP", ""):
                errors.append("Kafka production clients require SASL_SSL")
            if values.get("KAFKA_SSL_CLIENT_AUTH", "").lower() not in {"required", "requested"}:
                errors.append("Kafka production requires client certificate authentication")
        for container in [*pod_spec.get("initContainers", []), *pod_spec.get("containers", [])]:
            image = container.get("image", "")
            if "@sha256:" not in image:
                errors.append(f"mutable platform image reference: {image}")
            elif not re.search(r"@sha256:[0-9a-f]{64}$", image) or image.endswith(ZERO_DIGEST):
                if strict or not allow_unresolved:
                    errors.append(f"platform image requires a non-placeholder sha256 digest: {image.split('@', 1)[0]}")

    sealed = [doc for doc in documents if doc.get("kind") == "SealedSecret"]
    if len(sealed) != 1 and strict:
        errors.append("exactly one SealedSecret is required")
    if len(sealed) == 1:
        encrypted_data = sealed[0].get("spec", {}).get("encryptedData")
        if not encrypted_data and (strict or not allow_unsealed):
            errors.append("SealedSecret encryptedData must be populated before release")
        if strict and isinstance(encrypted_data, dict) and any(not isinstance(key, str) or not key.strip() or not isinstance(value, str) or not value.strip() for key, value in encrypted_data.items()):
            errors.append("SealedSecret encryptedData must contain non-empty ciphertext for every key")
    if strict:
        validate_enabled_provider_secret_refs(documents, app_data, errors)
    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment", choices=("dev", "staging", "prod"), required=True)
    parser.add_argument("--allow-unresolved", action="store_true")
    parser.add_argument("--allow-unsealed", action="store_true")
    args = parser.parse_args()

    catalog = json.loads((REPO / "infra/deployables.json").read_text(encoding="utf-8"))
    errors: list[str] = []
    lock = load_lock(args.environment, errors)
    lock_by_id: dict[str, dict] = {}
    validate_release_lock_presence(
        args.environment,
        lock,
        allow_unresolved=args.allow_unresolved,
        errors=errors,
    )
    if lock is not None:
        lock_by_id = validate_lock(lock, catalog, errors)

    first = render(args.environment)
    second = render(args.environment)
    if first != second:
        errors.append("Kustomize render is not deterministic")
    try:
        documents = [doc for doc in yaml.safe_load_all(first) if isinstance(doc, dict)]
    except yaml.YAMLError as error:
        errors.append(f"rendered YAML is invalid: {error}")
        fail(errors)
        return

    errors.extend(
        validate_release_policy(
            documents,
            args.environment,
            allow_unresolved=args.allow_unresolved,
            allow_unsealed=args.allow_unsealed,
        )
    )

    if any(document.get("kind") == "Secret" for document in documents):
        errors.append("rendered desired state must not contain plaintext Secret resources")

    expected_namespace = {
        "dev": "vnshop-dev", "staging": "vnshop-staging", "prod": "vnshop-prod"
    }[args.environment]
    namespaces = [doc for doc in documents if doc.get("kind") == "Namespace"]
    if [doc.get("metadata", {}).get("name") for doc in namespaces] != [expected_namespace]:
        errors.append(f"render must contain exactly Namespace/{expected_namespace}")

    catalog_by_id = {item["id"]: item for item in catalog["deployables"]}
    app_config = next(
        (
            doc for doc in documents
            if doc.get("kind") == "ConfigMap"
            and doc.get("metadata", {}).get("name") == "vnshop-app-config"
        ),
        None,
    )
    app_config_data = app_config.get("data", {}) if app_config else {}
    if not app_config:
        errors.append("vnshop-app-config ConfigMap is required")
    deployments = {}
    for document in documents:
        if document.get("kind") != "Deployment":
            continue
        artifact_id = document.get("metadata", {}).get("labels", {}).get("vnshop.io/artifact-id")
        if artifact_id:
            if artifact_id in deployments:
                errors.append(f"duplicate application Deployment for {artifact_id}")
            deployments[artifact_id] = document
    if set(deployments) != set(catalog_by_id):
        errors.append("rendered application Deployments must exactly match the 19-artifact catalog")

    for artifact_id, item in catalog_by_id.items():
        deployment = deployments.get(artifact_id)
        if not deployment:
            continue
        if deployment.get("metadata", {}).get("name") != item["workload"]:
            errors.append(f"{artifact_id}: workload name does not match catalog")
        containers = deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
        matching = [container for container in containers if container.get("name") == item["container"]]
        if len(matching) != 1:
            errors.append(f"{artifact_id}: expected one catalog container")
            continue
        container = matching[0]
        image = container.get("image", "")
        prefix = item["image"] + "@"
        if not image.startswith(prefix):
            errors.append(f"{artifact_id}: image repository does not match catalog")
        digest = image.removeprefix(prefix)
        if not DIGEST.fullmatch(digest):
            errors.append(f"{artifact_id}: image must use @sha256")
        if digest == ZERO_DIGEST and not args.allow_unresolved:
            errors.append(f"{artifact_id}: unresolved image digest")
        if lock_by_id and digest != lock_by_id.get(artifact_id, {}).get("digest"):
            errors.append(f"{artifact_id}: rendered digest differs from release lock")
        readiness = container.get("readinessProbe", {}).get("httpGet", {}).get("path")
        liveness = container.get("livenessProbe", {}).get("httpGet", {}).get("path")
        if readiness != item["probe"]["readiness"] or liveness != item["probe"]["liveness"]:
            errors.append(f"{artifact_id}: rendered probes differ from catalog")
        container_env = {
            entry.get("name") for entry in container.get("env", [])
            if isinstance(entry, dict) and entry.get("name")
        }
        missing_environment = sorted(
            REQUIRED_ENVIRONMENT.get(artifact_id, set())
            - (set(app_config_data) | container_env)
        )
        if missing_environment:
            errors.append(
                f"{artifact_id}: missing runtime environment keys: {', '.join(missing_environment)}"
            )

    if args.environment in {"staging", "prod"}:
        suffix = "vnshop.invalid" if args.environment == "staging" else "vnshop.example"
        origin_values = {key: value for key, value in app_config_data.items() if key.endswith("_ORIGIN") or key.endswith("_ORIGINS") or "PUBLIC_URL" in key or "CALLBACK_BASE_URL" in key or key == "KEYCLOAK_ISSUER_URI"}
        parsed_origins = {}
        for key, value in origin_values.items():
            values = [part.strip() for part in str(value).split(",")]
            parsed_values = [urlparse(part) for part in values]
            if any(_unsafe_origin(part) or parsed.hostname.endswith(".example.com") for part, parsed in zip(values, parsed_values, strict=True)):
                errors.append(f"vnshop-app-config {key} must be a real HTTPS origin")
            else:
                parsed_origins[key] = parsed_values[0].hostname
        for key in ("WEB_ORIGIN", "API_ORIGIN", "AUTH_ORIGIN", "KEYCLOAK_ISSUER_URI"):
            if key not in parsed_origins:
                errors.append(f"vnshop-app-config {key} is required for coherent origins")
        if parsed_origins.get("API_ORIGIN") and parsed_origins.get("AUTH_ORIGIN") and parsed_origins["API_ORIGIN"] != parsed_origins["AUTH_ORIGIN"]:
            errors.append("API_ORIGIN and AUTH_ORIGIN must use one authority")
        ingresses = [
            doc for doc in documents
            if doc.get("kind") == "Ingress" and doc.get("metadata", {}).get("name") == "vnshop"
        ]
        if len(ingresses) != 1:
            errors.append("exactly one VNShop ingress is required")
        else:
            ingress_hosts = {
                rule.get("host") for rule in ingresses[0].get("spec", {}).get("rules", [])
            }
            expected_hosts = {
                f"web.{suffix}", f"api.{suffix}", f"storage.{suffix}"
            }
            if ingress_hosts != expected_hosts:
                errors.append("ingress hosts must expose web, API, and storage TLS origins")
        validate_production_realm_hosts(args.environment, suffix, errors)

        if args.environment == "staging":
            realm_configmaps = [
                doc for doc in documents
                if doc.get("kind") == "ConfigMap"
                and doc.get("metadata", {}).get("name") == "vnshop-keycloak-realm"
            ]
            if len(realm_configmaps) != 1:
                errors.append("staging Keycloak realm ConfigMap is required")
            elif "vnshop-realm.json" not in realm_configmaps[0].get("data", {}):
                errors.append("staging Keycloak realm ConfigMap must contain vnshop-realm.json")
            staging_reconcile = [
                doc for doc in documents
                if doc.get("kind") == "Job"
                and doc.get("metadata", {}).get("name") == "vnshop-keycloak-reconcile"
            ]
            if len(staging_reconcile) != 1:
                errors.append("staging Keycloak reconcile hook is required")

        if args.environment == "prod":
            realm_configmaps = [
                doc for doc in documents
                if doc.get("kind") == "ConfigMap"
                and doc.get("metadata", {}).get("name") == "vnshop-keycloak-realm"
            ]
            if len(realm_configmaps) != 1:
                errors.append("production Keycloak realm ConfigMap is required")
            else:
                realm_data = realm_configmaps[0].get("data", {})
                if "vnshop-realm-prod.json" not in realm_data:
                    errors.append("production Keycloak realm ConfigMap must contain vnshop-realm-prod.json")
            keycloak = next(
                (doc for doc in documents
                 if doc.get("kind") == "Deployment"
                 and doc.get("metadata", {}).get("name") == "keycloak"),
                None,
            )
            keycloak_args = "\n".join(
                str(value)
                for container in (keycloak or {}).get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
                if container.get("name") == "keycloak"
                for value in container.get("args", [])
            )
            if "--import-realm" not in keycloak_args:
                errors.append("production Keycloak must start with --import-realm")
            keycloak_volume = any(
                mount.get("mountPath") == "/opt/keycloak/data/import"
                and mount.get("name") == "realm"
                for container in (keycloak or {}).get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
                for mount in container.get("volumeMounts", [])
            )
            if not keycloak_volume:
                errors.append("production Keycloak must mount the GitOps realm import directory")
            keycloak_secret_env = any(
                entry.get("name") == "GATEWAY_OAUTH2_CLIENT_SECRET"
                and entry.get("valueFrom", {}).get("secretKeyRef", {}).get("key") == "gateway-oauth2-client-secret"
                for container in (keycloak or {}).get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
                for entry in container.get("env", [])
            )
            if not keycloak_secret_env:
                errors.append("production Keycloak must receive gateway-oauth2-client-secret")

            reconcile_jobs = [
                doc for doc in documents
                if doc.get("kind") == "Job"
                and doc.get("metadata", {}).get("name") == "vnshop-keycloak-reconcile"
            ]
            if len(reconcile_jobs) != 1:
                errors.append("production Keycloak reconcile hook is required")
            else:
                annotations = reconcile_jobs[0].get("metadata", {}).get("annotations", {})
                if annotations.get("argocd.argoproj.io/hook") != "Sync":
                    errors.append("Keycloak reconcile hook must be an Argo Sync hook")
                reconcile_text = "\n".join(
                    str(value)
                    for container in reconcile_jobs[0].get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
                    for value in container.get("args", [])
                )
                reconcile_env = "\n".join(
                    str(value)
                    for container in reconcile_jobs[0].get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
                    for value in container.get("env", [])
                )
                for invariant in ("vnshop-monitoring", "GATEWAY_OAUTH2_CLIENT_SECRET", "kcadm.sh update"):
                    if invariant == "GATEWAY_OAUTH2_CLIENT_SECRET":
                        if invariant not in reconcile_text and invariant not in reconcile_env:
                            errors.append(f"Keycloak reconcile hook is missing {invariant}")
                        continue
                    if invariant not in reconcile_text:
                        errors.append(f"Keycloak reconcile hook is missing {invariant}")

    rendered_names = {doc.get("metadata", {}).get("name") for doc in documents}
    if "vnshop-coupon" in rendered_names or "vnshop-review" in rendered_names:
        errors.append("retired coupon/review workloads are still rendered")
    policies = [doc for doc in documents if doc.get("kind") == "NetworkPolicy"]
    if not any(doc.get("metadata", {}).get("name") == "default-deny" for doc in policies):
        errors.append("default-deny NetworkPolicy is required")
    internal_policy = next(
        (doc for doc in policies if doc.get("metadata", {}).get("name") == "allow-vnshop-internal"),
        None,
    )
    external_https = False
    if internal_policy:
        for rule in internal_policy.get("spec", {}).get("egress", []):
            peers = rule.get("to", [])
            ports = rule.get("ports", [])
            if any(peer.get("ipBlock", {}).get("cidr") == "0.0.0.0/0" for peer in peers) \
                    and any(port.get("protocol") == "TCP" and port.get("port") == 443 for port in ports):
                external_https = True
    if not external_https:
        errors.append("backup and alert workloads require public TCP/443 egress")
    sealed = [doc for doc in documents if doc.get("kind") == "SealedSecret"]
    if len(sealed) != 1:
        errors.append("exactly one SealedSecret is required")
    elif not sealed[0].get("spec", {}).get("encryptedData") and not args.allow_unsealed:
        errors.append("SealedSecret encryptedData must be populated before release")

    required_secret_keys = collect_required_secret_keys(documents, app_config_data)
    if sealed and sealed[0].get("spec", {}).get("encryptedData"):
        sealed_keys = set(sealed[0]["spec"]["encryptedData"])
        missing_keys = sorted(required_secret_keys - sealed_keys)
        if missing_keys:
            errors.append(f"SealedSecret is missing required keys: {', '.join(missing_keys)}")

    migration_jobs = [
        doc for doc in documents
        if doc.get("kind") == "Job" and doc.get("metadata", {}).get("name") == "vnshop-database-principals"
    ]
    if len(migration_jobs) != 1:
        errors.append("database migration Sync hook is required")
    else:
        annotations = migration_jobs[0].get("metadata", {}).get("annotations", {})
        if annotations.get("argocd.argoproj.io/hook") != "Sync":
            errors.append("database migration job must be an Argo Sync hook")
        if annotations.get("argocd.argoproj.io/hook-delete-policy") != "BeforeHookCreation,HookSucceeded":
            errors.append("database migration hook delete policy is incorrect")
        migration_args = "\n".join(
            str(value)
            for container in migration_jobs[0].get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
            for value in container.get("args", [])
        )
        for invariant in ("cart_svc.carts", "messaging_svc.threads", "own_schema_objects"):
            if invariant not in migration_args:
                errors.append(f"database migration hook is missing {invariant}")

    kafka_jobs = [
        doc for doc in documents
        if doc.get("kind") == "Job" and doc.get("metadata", {}).get("name") == "vnshop-kafka-bootstrap"
    ]
    if len(kafka_jobs) != 1:
        errors.append("Kafka topic and ACL Sync hook is required")
    else:
        annotations = kafka_jobs[0].get("metadata", {}).get("annotations", {})
        if annotations.get("argocd.argoproj.io/hook") != "Sync" \
                or annotations.get("argocd.argoproj.io/hook-delete-policy") != "BeforeHookCreation,HookSucceeded":
            errors.append("Kafka bootstrap hook policy is incorrect")

    storage_jobs = [
        doc for doc in documents
        if doc.get("kind") == "Job" and doc.get("metadata", {}).get("name") == "vnshop-storage-bootstrap"
    ]
    if len(storage_jobs) != 1:
        errors.append("scoped MinIO principal bootstrap Sync hook is required")
    else:
        annotations = storage_jobs[0].get("metadata", {}).get("annotations", {})
        if annotations.get("argocd.argoproj.io/hook") != "Sync" \
                or annotations.get("argocd.argoproj.io/hook-delete-policy") != "BeforeHookCreation,HookSucceeded":
            errors.append("MinIO principal bootstrap hook policy is incorrect")

    backup_policy = next(
        (doc for doc in documents if doc.get("kind") == "ConfigMap" and doc.get("metadata", {}).get("name") == "vnshop-backup-policy"),
        None,
    )
    if not backup_policy or backup_policy.get("data", {}).get("DAILY_RETENTION") != "14" \
            or backup_policy.get("data", {}).get("WEEKLY_RETENTION") != "8":
        errors.append("backup policy must retain 14 daily and 8 weekly copies")

    monitoring_config = next(
        (doc for doc in documents if doc.get("kind") == "ConfigMap" and doc.get("metadata", {}).get("name") == "vnshop-monitoring-config"),
        None,
    )
    if not monitoring_config:
        errors.append("GitOps monitoring configuration is required")
    else:
        prometheus_config = monitoring_config.get("data", {}).get("prometheus.yml", "")
        target_count = sum(
            prometheus_config.count(f'artifact_id: "{artifact_id}"')
            for artifact_id in catalog_by_id
        )
        if target_count != 19:
            errors.append("monitoring must contain exactly one readiness target for every artifact")
        alertmanager_config = monitoring_config.get("data", {}).get("alertmanager.yml", "")
        if "localhost" in alertmanager_config or "url_file:" not in alertmanager_config:
            errors.append("Alertmanager must use a secret-backed non-local webhook")

    prometheus_claims = [
        doc for doc in documents
        if doc.get("kind") == "PersistentVolumeClaim"
        and doc.get("metadata", {}).get("name") == "prometheus-data"
    ]
    if len(prometheus_claims) != 1:
        errors.append("Prometheus requires persistent storage for the 30-day SLO window")

    platform_images = []
    for document in documents:
        pod_spec = document.get("spec", {}).get("template", {}).get("spec")
        if document.get("kind") == "CronJob":
            pod_spec = document.get("spec", {}).get("jobTemplate", {}).get("spec", {}).get("template", {}).get("spec")
        if not isinstance(pod_spec, dict):
            continue
        platform_images.extend(container.get("image", "") for container in pod_spec.get("initContainers", []))
        platform_images.extend(container.get("image", "") for container in pod_spec.get("containers", []))
    for image in platform_images:
        if "@sha256:" not in image:
            errors.append(f"mutable platform image reference: {image}")

    fail(errors)
    digest = hashlib.sha256(first).hexdigest()
    print(f"{args.environment}: {len(deployments)} application images, render sha256:{digest}")


if __name__ == "__main__":
    main()

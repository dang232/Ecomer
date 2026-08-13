#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml


REPO = Path(__file__).resolve().parents[2]
DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
ZERO_DIGEST = "sha256:" + ("0" * 64)
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
    for client in realm.get("clients", []):
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
    if any(host.endswith(".example.com") for host in configured_hosts):
        errors.append("production Keycloak realm contains stale .example.com hosts")
    if not monitoring_client:
        errors.append("production Keycloak realm must define the monitoring OIDC client")
    else:
        expected_callback = f"https://api.{suffix}/monitoring/"
        if expected_callback not in monitoring_client.get("redirectUris", []):
            errors.append("monitoring OIDC client must authorize the gateway-served dashboard callback")


def render(environment: str) -> bytes:
    command = ["kubectl", "kustomize", str(REPO / "infra/k8s/overlays" / environment)]
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
            if not isinstance(artifact.get(field), str) or not artifact[field]:
                errors.append(f"{artifact_id}: {field} evidence URI is required")
        if artifact.get("provenanceVerified") is not True:
            errors.append(f"{artifact_id}: signed provenance must be verified before locking")
    return by_id


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
    if lock is None and not args.allow_unresolved:
        errors.append(f"missing infra/release/locks/{args.environment}.json")
    elif lock is not None:
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
        expected_public_config = {
            "WEB_ORIGIN": f"https://web.{suffix}",
            "API_ORIGIN": f"https://api.{suffix}",
            "AUTH_ORIGIN": f"https://api.{suffix}",
            "KEYCLOAK_ISSUER_URI": f"https://api.{suffix}/realms/vnshop",
            "KEYCLOAK_PUBLIC_BASE_URL": f"https://api.{suffix}",
            "VNSHOP_FRONTEND_URL": f"https://web.{suffix}",
            "VNSHOP_PUBLIC_API_URL": f"https://api.{suffix}",
            "VNSHOP_AUTH_CALLBACK_BASE_URL": f"https://api.{suffix}/auth/oauth/callback",
            "VNSHOP_OBJECT_STORAGE_PUBLIC_ENDPOINT": f"https://storage.{suffix}",
            "VNSHOP_USER_STORAGE_PUBLIC_ENDPOINT": f"https://storage.{suffix}",
        }
        for key, expected_value in expected_public_config.items():
            if app_config_data.get(key) != expected_value:
                errors.append(f"vnshop-app-config {key} must equal {expected_value}")
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

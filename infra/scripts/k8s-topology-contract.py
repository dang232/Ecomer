#!/usr/bin/env python3
"""Fail-closed topology and authority checks for the rendered production graph."""
from __future__ import annotations

import argparse
import json
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


def check(documents: list[dict]) -> list[str]:
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
    names = {(d.get("kind"), d.get("metadata", {}).get("name")) for d in documents}
    if ("CronJob", "db-backup") in names:
        errors.append("legacy backup CronJob is rendered")
    if ("CronJob", "vnshop-authoritative-backup") not in names:
        errors.append("authoritative backup CronJob is missing")
    return sorted(set(errors))


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
                errors = check(documents)
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
            errors = check(documents)
    except (OSError, RuntimeError, ValueError, yaml.YAMLError) as exc:
        print(json.dumps({"status": "BLOCKED_EXTERNAL", "errors": [str(exc)]}, sort_keys=True))
        return 1
    result = {"schema_version": "k8s-topology-contract.v1", "status": "PASS" if not errors else "FAIL", "errors": errors}
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())

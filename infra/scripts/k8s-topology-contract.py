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


def check(documents: list[dict]) -> list[str]:
    errors: list[str] = []
    identities = [(d.get("kind"), d.get("metadata", {}).get("name")) for d in documents]
    for kind, name in sorted(set(identities)):
        if identities.count((kind, name)) > 1:
            errors.append(f"duplicate rendered authority: {kind}/{name}")
    kafka = [d for d in documents if d.get("kind") == "StatefulSet" and d.get("metadata", {}).get("name") == "kafka"]
    if len(kafka) != 1:
        errors.append("exactly one rendered Kafka StatefulSet is required")
    else:
        spec = kafka[0].get("spec", {})
        if spec.get("replicas") != 3:
            errors.append("production Kafka authority must have three replicas")
        text = json.dumps(kafka[0], sort_keys=True).lower()
        for forbidden in ("sasl_plaintext", "plaintext://", "allow.everyone.if.no.acl.found=true"):
            if forbidden in text:
                errors.append(f"Kafka topology contains insecure setting: {forbidden}")
    elastic = [d for d in documents if d.get("kind") == "StatefulSet" and d.get("metadata", {}).get("name") == "elasticsearch"]
    if len(elastic) != 1:
        errors.append("exactly one rendered Elasticsearch StatefulSet is required")
    else:
        text = json.dumps(elastic[0], sort_keys=True).lower()
        for forbidden in ("single-node", '"xpack.security.enabled", "false"'):
            if forbidden in text:
                errors.append(f"Elasticsearch topology contains insecure setting: {forbidden}")
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
            errors = list(payload.get("errors", []))
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

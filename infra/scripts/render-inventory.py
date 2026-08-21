#!/usr/bin/env python3
"""Inventory the exact Kustomize output used by production authority."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
LEGACY = {"db-backup", "vnshop-coupon", "vnshop-review"}


def render(overlay: Path) -> bytes:
    result = subprocess.run(
        ["kubectl", "kustomize", str(overlay), "--load-restrictor", "LoadRestrictionsNone"],
        cwd=ROOT,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace").strip() or "kubectl kustomize failed")
    return result.stdout


def inventory(raw: bytes) -> dict:
    documents = [doc for doc in yaml.safe_load_all(raw) if isinstance(doc, dict)]
    identities: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    errors: list[str] = []
    for doc in documents:
        metadata = doc.get("metadata", {})
        kind = str(doc.get("kind", ""))
        name = str(metadata.get("name", ""))
        namespace = str(metadata.get("namespace", ""))
        identity = (kind, namespace, name)
        if identity in seen:
            errors.append(f"duplicate rendered resource: {kind}/{name} in {namespace or 'default'}")
        seen.add(identity)
        identities.append({"kind": kind, "name": name, "namespace": namespace})
        if name in LEGACY:
            errors.append(f"legacy resource is rendered: {kind}/{name}")
        if namespace == "vnshop":
            errors.append(f"legacy namespace is rendered: {kind}/{name}")
    names = {(item["kind"], item["name"]) for item in identities}
    if ("CronJob", "vnshop-authoritative-backup") not in names:
        errors.append("authoritative backup CronJob is missing from rendered graph")
    if sum(1 for kind, name in names if kind == "StatefulSet" and name == "kafka") > 1:
        errors.append("multiple Kafka StatefulSet authorities are rendered")
    return {
        "schema_version": "render-inventory.v1",
        "authority": "kubectl-kustomize:infra/k8s/overlays/prod",
        "manifest_sha256": hashlib.sha256(raw).hexdigest(),
        "resource_count": len(documents),
        "resources": sorted(identities, key=lambda item: (item["namespace"], item["kind"], item["name"])),
        "errors": sorted(set(errors)),
        "status": "PASS" if not errors else "FAIL",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--overlay", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--manifest", type=Path)
    args = parser.parse_args()
    try:
        if args.overlay is not None and args.overlay.resolve() != (ROOT / "infra/k8s/overlays/prod").resolve():
            raise ValueError("alternate overlay authority is rejected; production overlay is canonical")
        canonical = render(ROOT / "infra/k8s/overlays/prod")
        raw = canonical
        if args.manifest:
            supplied = args.manifest.read_bytes()
            if supplied != canonical:
                raise ValueError("supplied manifest is not byte-identical to canonical production render")
        result = inventory(raw)
    except (OSError, RuntimeError, yaml.YAMLError) as exc:
        result = {"schema_version": "render-inventory.v1", "status": "BLOCKED_EXTERNAL", "errors": [str(exc)]}
    payload = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
    print(payload, end="")
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

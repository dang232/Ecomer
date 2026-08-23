#!/usr/bin/env python3
"""Guarded Elasticsearch node-loss drill; never claims success without auth evidence."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml


def reject_target(target: dict) -> str | None:
    name = str(target.get("name", "")).strip().lower()
    if name in {"", "prod", "production"}:
        return "target must be a named isolated fixture, not production or empty"
    if target.get("production") is True or target.get("isolated") is not True:
        return "target must declare isolated=true and production=false"
    required = ("cluster_id", "namespace", "https_endpoint", "ca_path", "credential_principal")
    if any(not target.get(key) for key in required):
        return "target identity requires cluster_id, namespace, https_endpoint, ca_path, and credential_principal"
    if not str(target["https_endpoint"]).startswith("https://"):
        return "target endpoint must use HTTPS"
    if target.get("credential_principal") in {"elastic", "admin", "operator"}:
        return "node-loss drill requires an authenticated non-admin drill principal"
    if target.get("client_certificate_eku") not in {"clientAuth", "client auth"}:
        return "target client certificate must declare clientAuth EKU"
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Run an authenticated isolated Elasticsearch node-loss drill")
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--expected-cluster-id", required=True)
    parser.add_argument("--evidence", type=Path)
    args = parser.parse_args()
    result: dict[str, object] = {
        "schema_version": "elasticsearch-failure-drill.v1",
        "status": "BLOCKED_EXTERNAL",
        "authenticated_cluster": False,
        "node_loss_verified": False,
        "cleanup_receipt": "not-started",
        "errors": [],
    }
    try:
        if str(args.target).strip().lower() in {"", "prod", "production"}:
            result["status"] = "FAIL"
            result["errors"] = ["target must be a named isolated fixture, not production or empty"]
            return write(result, args.evidence, 1)
        if not args.target.exists():
            result["errors"] = [f"isolated target descriptor is missing: {args.target}"]
            return write(result, args.evidence, 2)
        target = yaml.safe_load(args.target.read_text(encoding="utf-8"))
        if not isinstance(target, dict):
            raise ValueError("target descriptor must be a mapping")
        error = reject_target(target)
        if error:
            result["status"] = "FAIL"
            result["errors"] = [error]
            return write(result, args.evidence, 1)
        if target["cluster_id"] != args.expected_cluster_id:
            result["status"] = "FAIL"
            result["errors"] = ["expected cluster identity does not match target descriptor"]
            return write(result, args.evidence, 1)
        result["errors"] = [
            "no authenticated real Elasticsearch cluster was contacted; node-loss success is not claimed",
            "drill requires operator-owned isolated cluster credentials and authenticated provenance",
        ]
        return write(result, args.evidence, 2)
    except (OSError, TypeError, ValueError, yaml.YAMLError) as exc:
        result["status"] = "FAIL"
        result["errors"] = [str(exc)]
        return write(result, args.evidence, 1)


def write(result: dict[str, object], evidence: Path | None, code: int) -> int:
    payload = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if evidence:
        evidence.parent.mkdir(parents=True, exist_ok=True)
        evidence.write_text(payload, encoding="utf-8")
    print(payload, end="")
    return code


if __name__ == "__main__":
    raise SystemExit(main())

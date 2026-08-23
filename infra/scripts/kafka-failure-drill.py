#!/usr/bin/env python3
"""Guarded Kafka broker-loss drill; never claims success without an authenticated cluster."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

import yaml


def reject_target(target: dict) -> str | None:
    name = str(target.get("name", "")).strip().lower()
    if name in {"", "prod", "production"}:
        return "target must be a named isolated fixture, not production or empty"
    if target.get("production") is True or target.get("isolated") is not True:
        return "target must declare isolated=true and production=false"
    if not target.get("cluster_id") or not target.get("namespace") or not target.get("bootstrap_servers"):
        return "target identity requires cluster_id, namespace, and bootstrap_servers"
    bootstrap_servers = target["bootstrap_servers"]
    if not isinstance(bootstrap_servers, list) or not bootstrap_servers:
        return "bootstrap_servers must be a non-empty list"
    for endpoint in bootstrap_servers:
        endpoint_text = str(endpoint)
        parsed = urlparse(endpoint_text)
        explicit_protocol = "://" in endpoint_text
        if parsed.scheme.upper() in {"PLAINTEXT", "SASL_PLAINTEXT"}:
            return "plaintext Kafka protocol or bootstrap endpoint is forbidden"
        if explicit_protocol and parsed.scheme.upper() != "SASL_SSL":
            return "Kafka bootstrap endpoints must use SASL_SSL when a protocol is declared"
        if "plaintext" in endpoint_text.lower():
            return "plaintext Kafka protocol or bootstrap endpoint is forbidden"
    if target.get("credential_principal") in {None, "", "kafka-admin"}:
        return "target requires an authenticated non-production drill principal"
    required_material = {
        "ca_certificate": "CA/client certificate material",
        "client_certificate": "CA/client certificate material",
        "sasl_mechanism": "SASL mechanism",
        "jaas_secret": "JAAS secret",
        "hostname_verification": "hostname verification",
    }
    missing = [label for field, label in required_material.items() if not target.get(field)]
    if missing:
        return "target requires " + ", ".join(dict.fromkeys(missing))
    if target["sasl_mechanism"] != "PLAIN":
        return "target SASL mechanism must be PLAIN"
    if target["hostname_verification"] != "HTTPS":
        return "target hostname verification must be HTTPS"
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--expected-cluster-id", required=True)
    parser.add_argument("--evidence", type=Path)
    args = parser.parse_args()
    result: dict[str, str | bool | list[str]] = {
        "schema_version": "kafka-failure-drill.v1",
        "status": "BLOCKED_EXTERNAL",
        "authenticated_cluster": False,
        "cleanup_receipt": "not-started",
        "errors": [],
    }
    try:
        target = yaml.safe_load(args.target.read_text(encoding="utf-8"))
        if not isinstance(target, dict):
            raise ValueError("target descriptor must be a mapping")
        if target.get("cluster_id") and target["cluster_id"] != args.expected_cluster_id:
            result["status"] = "FAIL"
            result["errors"] = ["expected cluster identity does not match target descriptor"]
            return _write(result, args.evidence, 1)
        error = reject_target(target)
        if error:
            result["status"] = "FAIL"
            result["errors"] = [error]
            return _write(result, args.evidence, 1)
        result["errors"] = [
            "no authenticated real Kafka cluster was contacted; broker-loss success is not claimed",
            "drill requires operator-owned isolated cluster credentials and authenticated provenance",
        ]
        result["execution_contract"] = "operator-only: apply, monitor, abort, rollback, and cleanup require authenticated isolated-cluster evidence"
        return _write(result, args.evidence, 2)
    except (OSError, TypeError, ValueError, yaml.YAMLError) as exc:
        result["status"] = "FAIL"
        result["errors"] = [str(exc)]
        return _write(result, args.evidence, 1)


def _write(result: dict[str, str | bool | list[str]], evidence: Path | None, code: int) -> int:
    payload = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if evidence:
        evidence.parent.mkdir(parents=True, exist_ok=True)
        evidence.write_text(payload, encoding="utf-8")
    print(payload, end="")
    return code


if __name__ == "__main__":
    raise SystemExit(main())

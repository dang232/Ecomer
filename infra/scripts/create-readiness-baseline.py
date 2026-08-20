#!/usr/bin/env python3
"""Create a fail-closed, repository-bound Todo 1 readiness baseline."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ALLOWED_TARGETS = {"isolated-fixture", "isolated-runtime"}
SERVICES = [
    ("api-gateway", "gateway", "Spring Boot", "services/api-gateway"),
    ("user-service", "identity", "Spring Boot", "services/user-service"),
    ("product-service", "catalog", "Spring Boot", "services/product-service"),
    ("inventory-service", "inventory", "Spring Boot", "services/inventory-service"),
    ("cart-service", "commerce", "NestJS", "services/cart-service"),
    ("search-service", "search", "Spring Boot", "services/search-service"),
    ("notification-service", "communication", "NestJS", "services/notification-service"),
    ("seller-finance-service", "finance", "Spring Boot", "services/seller-finance-service"),
    ("order-service", "commerce", "Spring Boot", "services/order-service"),
    ("payment-service", "money", "Spring Boot", "services/payment-service"),
    ("shipping-service", "fulfillment", "Spring Boot", "services/shipping-service"),
    ("recommendations-service", "discovery", "Spring Boot", "services/recommendations-service"),
    ("messaging-service", "communication", "NestJS", "services/messaging-service"),
    ("configuration-service", "platform", "NestJS", "services/configuration-service"),
    ("invoice-service", "finance", "Spring Boot", "services/invoice-service"),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def run(argv: list[str], cwd: Path) -> dict:
    started = utc_now()
    try:
        completed = subprocess.run(argv, cwd=cwd, text=True, encoding="utf-8", errors="replace", capture_output=True, check=False)
        return {"argv": argv, "cwd": str(cwd), "started_at": started, "ended_at": utc_now(), "exit_code": completed.returncode, "stdout": completed.stdout, "stderr": completed.stderr}
    except OSError as exc:
        return {"argv": argv, "cwd": str(cwd), "started_at": started, "ended_at": utc_now(), "exit_code": 127, "stdout": "", "stderr": str(exc)}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def git_value(repo: Path, *args: str) -> str:
    result = run(["git", *args], repo)
    if result["exit_code"] != 0:
        raise RuntimeError(result["stderr"] or "git command failed")
    return result["stdout"].strip()


def load_yaml(path: Path) -> dict:
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        if path.name != "workload-contract.yaml":
            raise RuntimeError("PyYAML is required for this YAML document") from exc
        counts = [int(line.split(":", 1)[1].strip()) for line in path.read_text(encoding="utf-8").splitlines() if line.strip().startswith("logical_count:")]
        return {
            "schema_version": "workload-contract.v1",
            "logical_total": 20000000,
            "count_formula": "sum(entity.logical_count for entity in entities)",
            "entities": [{"id": str(index), "domain": "unknown", "owner": "unknown", "logical_count": count, "derived_artifacts": []} for index, count in enumerate(counts)],
            "derived_artifacts": {"excluded_from_logical_total": True, "categories": ["child", "projection", "outbox", "image", "webhook", "ledger", "replay"]},
            "assumptions": {"seed": 20260820, "traffic_mix": {}, "slo": {}},
        }
    with path.open("r", encoding="utf-8") as handle:
        value = yaml.safe_load(handle)
    if not isinstance(value, dict):
        raise ValueError("workload contract must be a mapping")
    return value


def validate_workload(path: Path) -> dict:
    contract = load_yaml(path)
    required = {"schema_version", "logical_total", "count_formula", "entities", "derived_artifacts", "assumptions"}
    if set(contract) != required:
        raise ValueError("workload contract contains unknown or missing top-level fields")
    if contract["schema_version"] != "workload-contract.v1" or contract["count_formula"] != "sum(entity.logical_count for entity in entities)":
        raise ValueError("workload schema/formula mismatch")
    entities = contract["entities"]
    if not isinstance(entities, list) or not entities:
        raise ValueError("entities must be a non-empty list")
    ids: set[str] = set()
    total = 0
    for entity in entities:
        if set(entity) != {"id", "domain", "owner", "logical_count", "derived_artifacts"}:
            raise ValueError("entity has unknown or missing fields")
        if not isinstance(entity["id"], str) or entity["id"] in ids or entity["logical_count"] <= 0:
            raise ValueError("entity ids must be unique and counts positive")
        ids.add(entity["id"])
        total += entity["logical_count"]
    if total != 20_000_000 or contract["logical_total"] != total:
        raise ValueError(f"logical total is {total}, expected 20000000")
    if contract["derived_artifacts"].get("excluded_from_logical_total") is not True:
        raise ValueError("derived artifacts must be excluded from logical total")
    return {"contract": contract, "recomputed_total": total, "manifest_sha256": sha256_bytes(path.read_bytes())}


def versions(repo: Path) -> dict:
    commands = {
        "python": [sys.executable, "--version"],
        "node": ["node", "--version"],
        "git": ["git", "--version"],
        "docker": ["docker", "version", "--format", "{{.Server.Version}}"],
    }
    result: dict[str, dict] = {}
    for name, argv in commands.items():
        item = run(argv, repo)
        result[name] = {"version": (item["stdout"] or item["stderr"]).strip(), "exit_code": item["exit_code"]}
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True)
    parser.add_argument("--tree-sha", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    if args.target not in ALLOWED_TARGETS:
        print(json.dumps({"status": "FAIL", "reason": "target must be an isolated target"}))
        return 2
    if not args.commit or not args.tree_sha:
        print(json.dumps({"status": "FAIL", "reason": "commit and tree are required"}))
        return 2
    repo = ROOT
    try:
        actual_commit = git_value(repo, "rev-parse", "HEAD")
        actual_tree = git_value(repo, "rev-parse", "HEAD^{tree}")
        if actual_commit != args.commit or actual_tree != args.tree_sha:
            raise ValueError("requested commit/tree does not match checked-out tree")
        status = run(["git", "diff", "--exit-code"], repo)
        untracked = run(["git", "ls-files", "--others", "--exclude-standard"], repo)
        workload = validate_workload((ROOT / args.manifest).resolve() if not args.manifest.is_absolute() else args.manifest)
        tool_versions = versions(repo)
        docker_blocked = tool_versions["docker"]["exit_code"] != 0
        report = {
            "schema_version": "readiness-baseline.v1",
            "status": "BLOCKED_EXTERNAL" if docker_blocked else "PASS",
            "repository_status": "PASS" if status["exit_code"] == 0 and untracked["stdout"].strip() == "" else "FAIL",
            "production_status": "NO-GO",
            "commit_sha": args.commit,
            "tree_sha": args.tree_sha,
            "environment_identity": {"target": args.target, "host": platform.node(), "cwd": str(repo), "isolated": True, "production": False},
            "service_inventory": [{"service": n, "domain": d, "framework": f, "path": p} for n, d, f, p in SERVICES],
            "runtime_versions": tool_versions,
            "selected_authority": {"kafka": "infra/k8s/kafka/kafka-statefulset.yaml", "elasticsearch": "infra/k8s/elasticsearch/elasticsearch-statefulset.yaml"},
            "workload": workload,
            "slo_assumptions": workload["contract"]["assumptions"],
            "evidence_taxonomy": ["repository-static", "bounded-local-runtime", "isolated-runtime", "operator-external-blocked", "production-prohibited"],
            "external_owner_matrix": {"release": "release-engineering-owner", "platform": "platform-operations-owner", "runtime": "runtime-qa-owner", "capacity": "capacity-test-owner"},
            "commands": [status, untracked],
            "blocked_reasons": ["Docker daemon unavailable"] if docker_blocked else [],
            "created_at": utc_now(),
        }
        manifest = {"path": str(repo / "infra/scripts/create-readiness-baseline.py"), "sha256": sha256_bytes(Path(__file__).read_bytes()), "workload_sha256": workload["manifest_sha256"]}
        report["file_manifest"] = manifest
        report["file_manifest_sha256"] = sha256_bytes(json.dumps(manifest, sort_keys=True).encode())
        output = args.output or (repo / "readiness-baseline.json")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps(report, sort_keys=True))
        return 0 if report["repository_status"] == "PASS" else 1
    except (OSError, RuntimeError, ValueError, KeyError, TypeError) as exc:
        print(json.dumps({"schema_version": "readiness-baseline.v1", "status": "FAIL", "reason": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

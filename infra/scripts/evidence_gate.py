#!/usr/bin/env python3
"""Behavioral adversarial evidence fixtures for the release gate."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


STATUSES = {"PASS", "FAIL", "BLOCKED_EXTERNAL", "INCONCLUSIVE", "NO-GO"}
CASES = {"forged-status", "stale-sealed-report", "post-seal-mutation", "duplicate-evidence", "late-replacement", "alternate-workflow-override"}


def base_report() -> dict:
    return {
        "schema_version": "evidence.v1", "task_id": "2", "producer": "release-policy-owner", "owner": "release-policy-owner",
        "attempt_id": "attempt-20260820T103935Z-6b112282", "commit_sha": "a" * 40, "tree_sha": "b" * 40,
        "repository_status": "PASS", "production_status": "NO-GO", "created_at": "2026-08-20T10:00:00Z", "fresh_until": "2026-08-20T11:00:00Z",
        "provenance": {"producer_identity": "release-policy-owner", "owner": "release-policy-owner", "environment_identity": {"isolated": True}, "command_binding": "fixture", "artifact_digest": "c" * 64, "signature_type": "repository-commit"},
    }


def rejected(report: dict, sealed: dict | None = None, deadline: str = "2026-08-20T10:30:00Z") -> tuple[bool, str]:
    if report.get("production_status") not in STATUSES or report.get("production_status") == "GO":
        return True, "forged or closed-enum status"
    if report.get("fresh_until", "") < report.get("created_at", ""):
        return True, "stale evidence"
    if report.get("duplicate_of"):
        return True, "duplicate evidence"
    if sealed is not None:
        expected = sealed.get("report_sha256")
        actual = hashlib.sha256(json.dumps(report, sort_keys=True).encode()).hexdigest()
        if expected != actual:
            return True, "post-seal mutation"
    if report.get("created_at", "") > deadline:
        return True, "late replacement"
    if report.get("workflow") == "direct-apply" or report.get("authority") != "argocd-application:vnshop-prod":
        return True, "alternate workflow override"
    required = ("commands", "inputs", "outputs", "file_manifest_sha256")
    if any(key not in report or not report[key] for key in required):
        return True, "missing evidence fields"
    provenance = report.get("provenance")
    if not isinstance(provenance, dict) or any(not provenance.get(key) for key in ("producer_identity", "owner", "environment_identity", "command_binding", "artifact_digest", "signature_type")):
        return True, "missing provenance"
    if report.get("evidence_class") == "operator-external-blocked" and provenance.get("signature_type") == "repository-commit":
        return True, "self-authored external evidence"
    return False, "accepted"


def fixture(case: str, root: Path) -> tuple[dict, str]:
    report = base_report()
    sealed = None
    if case == "forged-status":
        report["production_status"] = "GO"
    elif case == "stale-sealed-report":
        report["fresh_until"] = "2026-08-20T09:00:00Z"
    elif case == "post-seal-mutation":
        sealed = {"report_sha256": hashlib.sha256(json.dumps(report, sort_keys=True).encode()).hexdigest()}
        report["repository_status"] = "FAIL"
    elif case == "duplicate-evidence":
        report["duplicate_of"] = "same-report"
    elif case == "late-replacement":
        report["created_at"] = "2026-08-20T12:00:00Z"
    elif case == "alternate-workflow-override":
        report["workflow"] = "direct-apply"
        report["authority"] = "kubectl-apply"
    input_path = root / f"{case}.input.json"
    input_path.write_text(json.dumps({"report": report, "sealed": sealed}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report, sealed


def evaluate(root: Path, cases: list[str]) -> dict:
    results = {}
    root.mkdir(parents=True, exist_ok=True)
    for case in cases:
        if case not in CASES:
            results[case] = {"status": "FAIL", "reason": "unknown adversarial case"}
            continue
        report, sealed = fixture(case, root)
        is_rejected, reason = rejected(report, sealed)
        result = {"status": "PASS" if is_rejected else "FAIL", "rejected": is_rejected, "reason": reason, "production_status": "NO-GO", "input": f"{case}.input.json"}
        (root / f"{case}.result.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        results[case] = result
    all_pass = bool(results) and all(item.get("status") == "PASS" for item in results.values())
    return {"schema_version": "evidence-gate.v1", "status": "PASS" if all_pass else "FAIL", "cases": results}


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    matrix = sub.add_parser("test-matrix")
    matrix.add_argument("--cases", required=True)
    matrix.add_argument("--evidence-dir", type=Path, required=True)
    args = parser.parse_args()
    result = evaluate(args.evidence_dir, [case for case in args.cases.split(",") if case])
    (args.evidence_dir / "evidence-gate-result.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

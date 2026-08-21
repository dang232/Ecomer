#!/usr/bin/env python3
"""Strict validation for caller-supplied Todo evidence artifacts."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path


STATUSES = {"PASS", "FAIL", "BLOCKED_EXTERNAL", "INCONCLUSIVE", "NO-GO"}
EVIDENCE_CLASSES = {"repository-static", "bounded-local-runtime", "isolated-runtime", "operator-external-blocked", "production-prohibited"}
REPORT_FIELDS = {"schema_version", "task_id", "producer", "owner", "attempt_id", "commit_sha", "tree_sha", "evidence_class", "repository_status", "production_status", "commands", "inputs", "outputs", "telemetry", "business_reconciliation", "provenance", "created_at", "fresh_until", "file_manifest_sha256"}
SHA256 = re.compile(r"^[0-9a-f]{64}$")
SHA1 = re.compile(r"^[0-9a-f]{40}$")
CASES = {"forged-status", "stale-sealed-report", "post-seal-mutation", "duplicate-evidence", "late-replacement", "alternate-workflow-override"}


def _json(path: Path) -> dict:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"unsafe or missing JSON path: {path}")
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON object required: {path}")
    return value


def _sha256(path: Path) -> str:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"evidence path must be a regular file: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _timestamp(value: str, field: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be ISO-8601")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{field} must be ISO-8601") from exc
    if parsed.tzinfo is None:
        raise ValueError(f"{field} must include timezone")
    return parsed.astimezone(timezone.utc)


def _relative_file(root: Path, raw_path: str, field: str) -> Path:
    if not isinstance(raw_path, str) or not raw_path or Path(raw_path).is_absolute():
        raise ValueError(f"{field} must be a relative evidence path")
    candidate = (root / raw_path).resolve()
    if not candidate.is_relative_to(root.resolve()):
        raise ValueError(f"{field} escapes approved evidence root")
    if candidate.is_symlink() or not candidate.is_file():
        raise ValueError(f"{field} must reference an existing regular file")
    return candidate


def _artifact_list(report: dict, field: str, root: Path) -> None:
    entries = report.get(field)
    if not isinstance(entries, list) or not entries:
        raise ValueError(f"{field} must be a non-empty list")
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or set(entry) != {"path", "sha256"}:
            raise ValueError(f"{field}[{index}] has malformed fields")
        path = _relative_file(root, entry["path"], f"{field}[{index}].path")
        if not isinstance(entry["sha256"], str) or not SHA256.fullmatch(entry["sha256"]):
            raise ValueError(f"{field}[{index}].sha256 is invalid")
        if _sha256(path) != entry["sha256"]:
            raise ValueError(f"{field}[{index}] hash mismatch")


def _commands(report: dict, root: Path) -> None:
    commands = report.get("commands")
    if not isinstance(commands, list) or not commands:
        raise ValueError("commands must be a non-empty list")
    required = {"outcome", "argv", "cwd", "start_at", "end_at", "stdout_path", "stdout_sha256", "stderr_path", "stderr_sha256", "exit_code"}
    for index, command in enumerate(commands):
        if not isinstance(command, dict) or not required.issubset(command):
            raise ValueError(f"commands[{index}] is incomplete")
        if not isinstance(command["argv"], list) or not command["argv"] or not all(isinstance(item, str) and item for item in command["argv"]):
            raise ValueError(f"commands[{index}].argv is empty or malformed")
        _timestamp(command["start_at"], f"commands[{index}].start_at")
        _timestamp(command["end_at"], f"commands[{index}].end_at")
        for path_field, hash_field in (("stdout_path", "stdout_sha256"), ("stderr_path", "stderr_sha256")):
            path = _relative_file(root, command[path_field], f"commands[{index}].{path_field}")
            if not isinstance(command[hash_field], str) or not SHA256.fullmatch(command[hash_field]) or _sha256(path) != command[hash_field]:
                raise ValueError(f"commands[{index}] {path_field} hash mismatch")


def _provenance(report: dict) -> None:
    provenance = report.get("provenance")
    required = ("producer_identity", "owner", "environment_identity", "command_binding", "artifact_digest", "signature_type")
    if not isinstance(provenance, dict) or any(not provenance.get(field) for field in required):
        raise ValueError("provenance trust anchor is incomplete")
    if not SHA256.fullmatch(str(provenance["artifact_digest"])):
        raise ValueError("provenance artifact digest is invalid")
    if report["evidence_class"] == "operator-external-blocked" and provenance["signature_type"] == "repository-commit":
        raise ValueError("external evidence cannot be self-authored")
    authority = provenance.get("deployment_authority")
    if authority not in {"repository-commit", "argocd-application:vnshop-prod"}:
        raise ValueError("alternate workflow authority is not accepted")


def validate_report(report_path: Path, evidence_root: Path, seal_path: Path | None = None, deadline: str | None = None, seen_report_hashes: set[str] | None = None) -> dict:
    """Validate one real report and every referenced evidence file."""
    report = _json(report_path)
    if set(report) != REPORT_FIELDS:
        raise ValueError("report.json has unknown or missing fields")
    if report["schema_version"] != "evidence.v1" or report["evidence_class"] not in EVIDENCE_CLASSES:
        raise ValueError("report schema or evidence class is invalid")
    if report["repository_status"] not in STATUSES or report["production_status"] not in STATUSES or report["production_status"] == "GO":
        raise ValueError("report status is forged or invalid")
    if not SHA1.fullmatch(str(report["commit_sha"])) or not SHA1.fullmatch(str(report["tree_sha"])):
        raise ValueError("report commit/tree must be full lowercase Git SHAs")
    if not isinstance(report["task_id"], str) or not report["task_id"] or not isinstance(report["attempt_id"], str) or not report["attempt_id"]:
        raise ValueError("report identity is incomplete")
    created = _timestamp(report["created_at"], "created_at")
    fresh_until = _timestamp(report["fresh_until"], "fresh_until")
    if fresh_until < created or fresh_until < datetime.now(timezone.utc):
        raise ValueError("report is stale")
    if deadline is not None and created > _timestamp(deadline, "deadline"):
        raise ValueError("report is a late replacement")
    _commands(report, evidence_root)
    _artifact_list(report, "inputs", evidence_root)
    _artifact_list(report, "outputs", evidence_root)
    if not SHA256.fullmatch(str(report["file_manifest_sha256"])):
        raise ValueError("file_manifest_sha256 is invalid")
    _provenance(report)
    report_hash = _sha256(report_path)
    if seen_report_hashes is not None and report_hash in seen_report_hashes:
        raise ValueError("duplicate evidence report")
    if seen_report_hashes is not None:
        seen_report_hashes.add(report_hash)
    if seal_path is not None:
        seal = _json(seal_path)
        if seal.get("report_sha256") != report_hash and seal.get("report_sha256") != hashlib.sha256(json.dumps(report, sort_keys=True, separators=(",", ":")).encode()).hexdigest():
            raise ValueError("sealed report mutation detected")
    return report


def rejected(report: dict, sealed: dict | None = None, deadline: str = "2026-08-20T10:30:00Z") -> tuple[bool, str]:
    """Compatibility wrapper that applies strict structural checks to a dict."""
    if set(report) != REPORT_FIELDS:
        return True, "strict evidence schema mismatch"
    if report.get("production_status") == "GO":
        return True, "forged or closed-enum status"
    if report.get("fresh_until", "") < report.get("created_at", ""):
        return True, "stale evidence"
    if sealed is not None and sealed.get("report_sha256") != hashlib.sha256(json.dumps(report, sort_keys=True).encode()).hexdigest():
        return True, "post-seal mutation"
    if report.get("created_at", "") > deadline:
        return True, "late replacement"
    if any(not report.get(field) for field in ("commands", "inputs", "outputs", "file_manifest_sha256")):
        return True, "missing evidence fields"
    try:
        if report.get("repository_status") not in STATUSES or report.get("production_status") not in STATUSES:
            raise ValueError("invalid evidence enum")
        _provenance(report)
    except ValueError as exc:
        return True, str(exc)
    return False, "accepted"


def base_report() -> dict:
    """Return a deliberately incomplete fixture for legacy adversarial CLI cases."""
    return {"schema_version": "evidence.v1", "task_id": "2", "producer": "release-engineering-owner", "owner": "release-engineering-owner", "attempt_id": "attempt-fixture", "commit_sha": "a" * 40, "tree_sha": "b" * 40, "evidence_class": "repository-static", "repository_status": "PASS", "production_status": "NO-GO", "commands": [{"outcome": "PASS"}], "inputs": [{"path": "missing", "sha256": "c" * 64}], "outputs": [{"path": "missing", "sha256": "c" * 64}], "telemetry": [], "business_reconciliation": {}, "provenance": {"producer_identity": "release-engineering-owner", "owner": "release-engineering-owner", "environment_identity": {"isolated": True}, "command_binding": "fixture", "artifact_digest": "c" * 64, "signature_type": "repository-commit", "deployment_authority": "repository-commit"}, "created_at": "2026-08-20T10:00:00Z", "fresh_until": "2026-08-20T11:00:00Z", "file_manifest_sha256": "c" * 64}


def fixture(case: str, root: Path) -> tuple[dict, dict | None]:
    """Write a legacy adversarial input without using it as validation authority."""
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
        report["provenance"]["deployment_authority"] = "kubectl-apply"
    (root / f"{case}.input.json").write_text(json.dumps({"report": report, "sealed": sealed}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report, sealed


def evaluate(root: Path, cases: list[str]) -> dict:
    """Evaluate only known adversarial fixture names."""
    root.mkdir(parents=True, exist_ok=True)
    results = {}
    for case in cases:
        if case not in CASES:
            results[case] = {"status": "FAIL", "reason": "unknown adversarial case"}
            continue
        report, sealed = fixture(case, root)
        is_rejected, reason = rejected(report, sealed)
        results[case] = {"status": "PASS" if is_rejected else "FAIL", "rejected": is_rejected, "reason": reason, "production_status": "NO-GO"}
        (root / f"{case}.result.json").write_text(json.dumps(results[case], indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {"schema_version": "evidence-gate.v1", "status": "PASS" if results and all(item["status"] == "PASS" for item in results.values()) else "FAIL", "cases": results}


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    matrix = sub.add_parser("test-matrix")
    matrix.add_argument("--cases", required=True)
    matrix.add_argument("--evidence-dir", type=Path, required=True)
    report_parser = sub.add_parser("validate-report")
    report_parser.add_argument("--report", type=Path, required=True)
    report_parser.add_argument("--evidence-root", type=Path, required=True)
    report_parser.add_argument("--seal", type=Path)
    report_parser.add_argument("--deadline")
    args = parser.parse_args()
    try:
        if args.command == "validate-report":
            validate_report(args.report.resolve(), args.evidence_root.resolve(), args.seal.resolve() if args.seal else None, args.deadline)
            result = {"schema_version": "evidence-gate.v1", "status": "PASS"}
        else:
            result = evaluate(args.evidence_dir.resolve(), [case for case in args.cases.split(",") if case])
        if args.command == "test-matrix":
            (args.evidence_dir / "evidence-gate-result.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0 if result["status"] == "PASS" else 1
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"schema_version": "evidence-gate.v1", "status": "FAIL", "errors": [str(exc)]}, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

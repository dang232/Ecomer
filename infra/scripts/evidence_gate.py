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
COMMAND_OUTCOMES = {"PASS", "FAIL", "EXPECTED_REJECTION", "BLOCKED_EXTERNAL", "SKIPPED_DUE_TO_PRIOR_FAILURE"}
REPORT_FIELDS = {"schema_version", "task_id", "producer", "owner", "attempt_id", "commit_sha", "tree_sha", "evidence_class", "repository_status", "production_status", "commands", "inputs", "outputs", "telemetry", "business_reconciliation", "provenance", "created_at", "fresh_until", "file_manifest_sha256"}
SHA256 = re.compile(r"^[0-9a-f]{64}$")
SHA1 = re.compile(r"^[0-9a-f]{40}$")
CASES = {"forged-status", "forged-manifest-digest", "forged-artifact-digest", "path-traversal", "incomplete-command", "stale-sealed-report", "post-seal-mutation", "duplicate-evidence", "late-replacement", "alternate-workflow-override", "self-authored-external"}


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


def _manifest_digest(report: dict, root: Path) -> str:
    """Require the report manifest hash to name a real output artifact."""
    outputs = report.get("outputs")
    if not isinstance(outputs, list):
        raise ValueError("outputs must be a list")
    manifests = [entry for entry in outputs if isinstance(entry, dict) and Path(str(entry.get("path", ""))).name == "file-manifest.json"]
    if len(manifests) != 1:
        raise ValueError("outputs must contain exactly one file-manifest.json")
    manifest = manifests[0]
    if manifest["sha256"] != report["file_manifest_sha256"]:
        raise ValueError("file_manifest_sha256 is not bound to file-manifest.json")
    path = _relative_file(root, manifest["path"], "outputs.file-manifest.json.path")
    actual = _sha256(path)
    if actual != report["file_manifest_sha256"]:
        raise ValueError("file_manifest.json hash mismatch")
    return actual


def _report_hash(report_path: Path) -> str:
    """Hash the exact serialized report bytes used by seal binding."""
    return _sha256(report_path)


def _commands(report: dict, root: Path) -> None:
    commands = report.get("commands")
    if not isinstance(commands, list) or not commands:
        raise ValueError("commands must be a non-empty list")
    required = {"outcome", "argv", "cwd", "start_at", "end_at", "stdout_path", "stdout_sha256", "stderr_path", "stderr_sha256", "exit_code"}
    for index, command in enumerate(commands):
        if not isinstance(command, dict) or not required.issubset(command):
            raise ValueError(f"commands[{index}] is incomplete")
        if command["outcome"] not in COMMAND_OUTCOMES:
            raise ValueError(f"commands[{index}] outcome or exit_code is invalid")
        if command["outcome"] == "SKIPPED_DUE_TO_PRIOR_FAILURE":
            if command["exit_code"] is not None:
                raise ValueError(f"commands[{index}] skipped command must not have an exit_code")
        elif not isinstance(command["exit_code"], int):
            raise ValueError(f"commands[{index}] outcome or exit_code is invalid")
        if not isinstance(command["argv"], list) or not command["argv"] or not all(isinstance(item, str) and item for item in command["argv"]):
            raise ValueError(f"commands[{index}].argv is empty or malformed")
        start = _timestamp(command["start_at"], f"commands[{index}].start_at")
        end = _timestamp(command["end_at"], f"commands[{index}].end_at")
        if end < start:
            raise ValueError(f"commands[{index}] timestamps are out of order")
        if command["outcome"] == "PASS" and command["exit_code"] != 0:
            raise ValueError(f"commands[{index}] PASS must have exit_code 0")
        if command["outcome"] != "PASS" and command["exit_code"] == 0:
            raise ValueError(f"commands[{index}] non-PASS must have nonzero exit_code")
        if command["stdout_path"] == command["stderr_path"]:
            raise ValueError(f"commands[{index}] stdout and stderr artifacts must be distinct")
        for path_field, hash_field in (("stdout_path", "stdout_sha256"), ("stderr_path", "stderr_sha256")):
            path = _relative_file(root, command[path_field], f"commands[{index}].{path_field}")
            if not isinstance(command[hash_field], str) or not SHA256.fullmatch(command[hash_field]) or _sha256(path) != command[hash_field]:
                raise ValueError(f"commands[{index}] {path_field} hash mismatch")


def _provenance(report: dict) -> None:
    provenance = report.get("provenance")
    required = ("producer_identity", "owner", "environment_identity", "command_binding", "artifact_digest", "signature_type")
    if not isinstance(provenance, dict) or any(not provenance.get(field) for field in required):
        raise ValueError("provenance trust anchor is incomplete")
    if provenance["producer_identity"] != report["producer"] or provenance["owner"] != report["owner"]:
        raise ValueError("report and provenance identities do not match")
    if not SHA256.fullmatch(str(provenance["artifact_digest"])):
        raise ValueError("provenance artifact digest is invalid")
    external = report["evidence_class"] in {"isolated-runtime", "operator-external-blocked"}
    if external and provenance["signature_type"] == "repository-commit":
        raise ValueError("external evidence cannot be self-authored")
    if external and not provenance.get("provider_issued_id"):
        raise ValueError("external evidence requires a provider-issued identifier")
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
    _provenance(report)
    manifest_digest = _manifest_digest(report, evidence_root)
    if report["provenance"]["artifact_digest"] != manifest_digest:
        raise ValueError("provenance artifact digest must bind to file-manifest.json")
    report_hash = _sha256(report_path)
    if seen_report_hashes is not None and report_hash in seen_report_hashes:
        raise ValueError("duplicate evidence report")
    if seen_report_hashes is not None:
        seen_report_hashes.add(report_hash)
    if seal_path is not None:
        seal = _json(seal_path)
        if seal.get("report_sha256") != report_hash:
            raise ValueError("sealed report mutation detected")
    return report


def rejected(report: dict, sealed: dict | None = None, deadline: str | None = None, root: Path | None = None) -> tuple[bool, str]:
    """Reject a report unless the real artifact validator can inspect its files."""
    if root is None:
        return True, "real evidence root is required"
    report_path = root / "report.json"
    report_path.write_text(json.dumps(report, sort_keys=True) + "\n", encoding="utf-8")
    seal_path = None
    if sealed is not None:
        seal_path = root / "sealed.json"
        seal_path.write_text(json.dumps(sealed, sort_keys=True) + "\n", encoding="utf-8")
    try:
        validate_report(report_path, root, seal_path, deadline)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return True, str(exc)
    return False, "accepted"


def base_report(root: Path | None = None) -> dict:
    """Create a complete report fixture when an evidence root is provided."""
    if root is None:
        return {"schema_version": "evidence.v1"}
    for name in ("stdout.txt", "stderr.txt", "input.json", "output.json"):
        (root / name).write_text(name, encoding="utf-8")
    manifest = root / "file-manifest.json"
    manifest.write_text(json.dumps({"files": ["output.json"]}, sort_keys=True) + "\n", encoding="utf-8")
    manifest_hash = _sha256(manifest)
    return {"schema_version": "evidence.v1", "task_id": "2", "producer": "release-engineering-owner", "owner": "release-engineering-owner", "attempt_id": "attempt-fixture", "commit_sha": "a" * 40, "tree_sha": "b" * 40, "evidence_class": "repository-static", "repository_status": "PASS", "production_status": "NO-GO", "commands": [{"outcome": "PASS", "argv": ["python", "-c", "pass"], "cwd": ".", "start_at": "2099-01-01T00:00:00Z", "end_at": "2099-01-01T00:00:01Z", "stdout_path": "stdout.txt", "stdout_sha256": _sha256(root / "stdout.txt"), "stderr_path": "stderr.txt", "stderr_sha256": _sha256(root / "stderr.txt"), "exit_code": 0}], "inputs": [{"path": "input.json", "sha256": _sha256(root / "input.json")}], "outputs": [{"path": "file-manifest.json", "sha256": manifest_hash}, {"path": "output.json", "sha256": _sha256(root / "output.json")}], "telemetry": [], "business_reconciliation": {"not_applicable": "static"}, "provenance": {"producer_identity": "release-engineering-owner", "owner": "release-engineering-owner", "environment_identity": {"isolated": True}, "command_binding": "fixture", "artifact_digest": manifest_hash, "signature_type": "repository-commit", "deployment_authority": "repository-commit"}, "created_at": "2099-01-01T00:00:00Z", "fresh_until": "2099-01-02T00:00:00Z", "file_manifest_sha256": manifest_hash}


def fixture(case: str, root: Path) -> tuple[dict, dict | None]:
    """Write complete hostile artifacts and mutate one trust boundary per case."""
    report = base_report(root)
    sealed = None
    if case == "forged-manifest-digest":
        report["file_manifest_sha256"] = "0" * 64
    elif case == "forged-artifact-digest":
        report["provenance"]["artifact_digest"] = "0" * 64
    elif case == "path-traversal":
        report["inputs"][0]["path"] = "../outside"
    elif case == "incomplete-command":
        report["commands"][0].pop("argv")
    elif case == "forged-status":
        report["production_status"] = "GO"
    elif case == "stale-sealed-report":
        report["fresh_until"] = "2000-01-01T00:00:00Z"
    elif case == "post-seal-mutation":
        report_path = root / "report.json"
        report_path.write_text(json.dumps(report, sort_keys=True) + "\n", encoding="utf-8")
        sealed = {"report_sha256": _sha256(report_path)}
        report["repository_status"] = "FAIL"
    elif case == "late-replacement":
        report["created_at"] = "2099-01-01T00:00:00Z"
    elif case == "alternate-workflow-override":
        report["provenance"]["deployment_authority"] = "kubectl-apply"
    elif case == "self-authored-external":
        report["evidence_class"] = "operator-external-blocked"
    (root / f"{case}.input.json").write_text(json.dumps({"report": report, "sealed": sealed}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report, sealed


def evaluate(root: Path, cases: list[str]) -> dict:
    """Evaluate hostile cases through validate_report and real artifact hashes."""
    root.mkdir(parents=True, exist_ok=True)
    results = {}
    for case in cases:
        if case not in CASES:
            results[case] = {"status": "FAIL", "reason": "unknown adversarial case"}
            continue
        case_root = root / case
        case_root.mkdir(parents=True, exist_ok=True)
        report, sealed = fixture(case, case_root)
        report_path = case_root / "report.json"
        report_path.write_text(json.dumps(report, sort_keys=True) + "\n", encoding="utf-8")
        if case == "duplicate-evidence":
            report_path.write_bytes((case_root / "report.json").read_bytes())
            seen = {_sha256(report_path)}
            (case_root / "duplicate.json").write_bytes(report_path.read_bytes())
            try:
                validate_report(case_root / "duplicate.json", case_root, seen_report_hashes=seen)
                is_rejected, reason = False, "duplicate evidence accepted"
            except ValueError as exc:
                is_rejected, reason = True, str(exc)
        else:
            seal_path = None
            if sealed is not None:
                seal_path = case_root / "sealed.json"
                seal_path.write_text(json.dumps(sealed, sort_keys=True) + "\n", encoding="utf-8")
            try:
                validate_report(report_path, case_root, seal_path, "2098-12-31T00:00:00Z" if case == "late-replacement" else None)
                is_rejected, reason = False, "accepted"
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                is_rejected, reason = True, str(exc)
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

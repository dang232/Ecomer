#!/usr/bin/env python3
"""Canonical Todo 1 evidence lifecycle. All validation is fail-closed."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path


SCHEMA = "evidence.v1"
EVIDENCE_CLASSES = {"repository-static", "bounded-local-runtime", "isolated-runtime", "operator-external-blocked", "production-prohibited"}
STATUSES = {"PASS", "FAIL", "BLOCKED_EXTERNAL", "INCONCLUSIVE", "NO-GO"}
ALLOWED_PATHS = {
    "infra/scripts/evidence_session.py", "infra/scripts/create-readiness-baseline.py", "infra/scripts/powershell-runner.py",
    "infra/scripts/qa-command-matrix.yaml", "infra/load-tests/workload-contract.yaml",
    "infra/scripts/test_todo1_contracts.py", "infra/scripts/test_todo2_contracts.py", "infra/scripts/test_todo3_contracts.py", "infra/scripts/test_todo4_contracts.py", "infra/scripts/test_todo5_contracts.py", "infra/scripts/test_todo6_contracts.py", "infra/scripts/test_todo7_contracts.py", "infra/scripts/validate-k8s-release.py", "infra/scripts/validate-k8s-release.test.py",
    "infra/scripts/render-inventory.py", "infra/scripts/k8s-topology-contract.py", "infra/scripts/evidence_gate.py",
    "infra/scripts/plan_contract_check.py", "infra/scripts/quality_gate.py", "infra/scripts/scope_gate.py",
    "infra/scripts/kafka-failure-drill.py", "infra/scripts/kafka-inventory-contract.py", "infra/scripts/elasticsearch-failure-drill.py", "infra/scripts/elasticsearch-inventory-contract.py", "infra/scripts/restore-fixture.py",
    "infra/scripts/restore-drill.py", "infra/load-tests/dataset/manifest.yaml", "infra/load-tests/dataset/generate.py",
    "infra/load-tests/k6-10k-dau.js", "infra/load-tests/k6-load.js", "infra/load-tests/k6-smoke.js", "infra/load-tests/k6-release.js", "infra/load-tests/k6-flash-sale.js", "infra/load-tests/provider-isolation-preflight.py", "infra/scripts/provider-preflight.py", "infra/evidence/production-gates.yaml",
    ".github/workflows/ci.yml", ".github/workflows/cd.yml", ".github/workflows/promote.yml",
    ".github/workflows/verify-production.yml", ".github/workflows/verify-backup.yml",
    ".github/workflows/test-alert-delivery.yml", ".github/workflows/rollback.yml",
    "docs/operations/release-and-recovery.md", "docs/PRODUCTION-READINESS-REVIEW.md",
    "docs/PRODUCTION-READINESS-CLOSURE-PLAN.md", "infra/production-no-go-checklist.md", "infra/k8s/kafka/kafka-statefulset.yaml", "infra/k8s/elasticsearch/elasticsearch-statefulset.yaml", "infra/k8s/base/kustomization.yaml", "infra/k8s/base/platform-services.yaml", "infra/k8s/base/workloads.yaml", "infra/k8s/base/backup-jobs.yaml", "infra/k8s/base/jobs/db-backup-cronjob.yaml", "infra/scripts/backup.sh", "infra/scripts/restore.sh", "infra/scripts/backup-cron.sh",
}
RUN_FIELDS = {"attempt_id", "schema_version", "requested_commit", "requested_tree", "deployment_authority", "environment_identity", "created_at", "workspace_manifest_sha256", "detached_baseline_manifest_sha256", "workspace_closure_sha256", "detached_baseline_closure_sha256", "allowed_path_set_sha256"}
REPORT_FIELDS = {"schema_version", "task_id", "producer", "owner", "attempt_id", "commit_sha", "tree_sha", "evidence_class", "repository_status", "production_status", "commands", "inputs", "outputs", "telemetry", "business_reconciliation", "provenance", "created_at", "fresh_until", "file_manifest_sha256"}
CHECKPOINT_FIELDS = {"schema_version", "attempt_id", "task_id", "report_sha256", "input_manifest_sha256", "checkpoint_status", "created_at"}
REQUIRED_TASKS = ["1", "2", "3", "4", "5", "6", "7", "F1", "F2", "F3", "F4"]
VERIFIER_OWNERS = {
    "1": "runtime-qa-owner", "2": "release-engineering-owner", "3": "platform-operations-owner", "4": "platform-operations-owner",
    "5": "disaster-recovery-owner", "6": "capacity-test-owner", "7": "capacity-test-owner",
    "F1": "plan-compliance-owner", "F2": "code-quality-owner", "F3": "runtime-qa-owner", "F4": "scope-fidelity-owner",
}
REPORT_PRODUCERS = set(VERIFIER_OWNERS.values())


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def digest(path: Path) -> str:
    if path.is_symlink() or path.is_dir():
        raise ValueError(f"symlink/directory is not a file evidence path: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def atomic_write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and (path.is_symlink() or path.is_dir()):
        raise ValueError(f"unsafe evidence path: {path}")
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def load_json(path: Path) -> dict:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"unsafe or missing JSON path: {path}")
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON object required: {path}")
    return value


def strict(value: dict, fields: set[str], name: str) -> None:
    if set(value) != fields:
        raise ValueError(f"{name} has unknown or missing fields")


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=repo, text=True, capture_output=True, check=False)
    if result.returncode:
        raise ValueError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def environment(root: Path) -> dict:
    return {"host": os.environ.get("COMPUTERNAME", "unknown"), "user": os.environ.get("USERNAME", "unknown"), "root": str(root), "production": False, "isolated": True}


def capture(repo: Path, output: Path, kind: str, commit: str, tree: str) -> dict:
    if output.exists() and any(output.iterdir()):
        raise ValueError(f"capture output must be empty: {output}")
    output.mkdir(parents=True, exist_ok=True)
    actual_commit = git(repo, "rev-parse", "HEAD")
    actual_tree = git(repo, "rev-parse", "HEAD^{tree}")
    if kind == "detached" and (actual_commit != commit or actual_tree != tree):
        raise ValueError("detached repository identity does not match requested commit/tree")
    status = subprocess.run(["git", "status", "--porcelain=v1", "--untracked-files=all"], cwd=repo, text=True, encoding="utf-8", errors="replace", capture_output=True, check=False)
    if status.returncode != 0:
        raise ValueError("git status failed")
    if kind == "detached" and status.stdout.strip():
        raise ValueError("detached repository must be clean")
    tracked = git(repo, "ls-files").splitlines()
    entries = []
    for path in sorted(set(tracked)):
        full = repo / path
        if full.is_symlink():
            raise ValueError(f"reparse/symlink path is forbidden: {path}")
        entries.append({"path": path, "status": "  ", "sha256": digest(full) if full.is_file() else None})
    for line in status.stdout.splitlines():
        if len(line) < 4:
            continue
        path = line[3:].split(" -> ")[-1].replace("\\", "/")
        full = repo / path
        if full.is_symlink():
            raise ValueError(f"reparse/symlink path is forbidden: {path}")
        entries = [item for item in entries if item["path"] != path]
        entries.append({"path": path, "status": line[:2], "sha256": digest(full) if full.is_file() else None})
    manifest = {"schema_version": "prechange.v1", "capture_kind": kind, "commit_sha": commit, "tree_sha": tree, "entries": sorted(entries, key=lambda item: item["path"]), "captured_at": now()}
    manifest_path = output / "file-manifest.json"
    atomic_write(manifest_path, manifest)
    manifest_hash = digest(manifest_path)
    closure = {"schema_version": "closure.v1", "capture_kind": kind, "commit_sha": commit, "tree_sha": tree, "manifest_sha256": manifest_hash, "environment_identity": environment(output), "captured_at": manifest["captured_at"]}
    closure_path = output / "closure.json"
    atomic_write(closure_path, closure)
    closure_hash = digest(closure_path)
    capture_record = {"schema_version": "capture.v1", "capture_kind": kind, "commit_sha": commit, "tree_sha": tree, "manifest_sha256": manifest_hash, "closure_sha256": closure_hash, "captured_at": manifest["captured_at"]}
    atomic_write(output / "capture.json", capture_record)
    return {**capture_record, "entry_count": len(entries)}


def create(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    unexpected = [
        item for item in root.iterdir()
        if item.name != "prechange"
        and not (item.name.startswith("attempt-") and (item / "superseded.json").is_file())
        and not item.name.startswith("prechange-")
        and not item.name.startswith("verifier-")
    ]
    if unexpected:
        raise ValueError("evidence root may contain only the ordered prechange directory")
    if (root / "prechange").exists() and not (root / "prechange").is_dir():
        raise ValueError("prechange must be a directory")
    repo = Path.cwd().resolve()
    detached_capture = root / "prechange" / "detached" / "capture.json"
    if detached_capture.is_file():
        captured = load_json(detached_capture)
        commit = captured["commit_sha"]
        tree = captured["tree_sha"]
    else:
        commit = git(repo, "rev-parse", "HEAD")
        tree = git(repo, "rev-parse", "HEAD^{tree}")
    allowed_hash = hashlib.sha256("\n".join(sorted(ALLOWED_PATHS)).encode()).hexdigest()
    attempt = f"attempt-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    run_record = {"attempt_id": attempt, "schema_version": SCHEMA, "requested_commit": commit, "requested_tree": tree, "deployment_authority": "repository-commit", "environment_identity": environment(root), "created_at": now(), "workspace_manifest_sha256": None, "detached_baseline_manifest_sha256": None, "workspace_closure_sha256": None, "detached_baseline_closure_sha256": None, "allowed_path_set_sha256": allowed_hash}
    atomic_write(root / attempt / "run.json", run_record)
    print(json.dumps(run_record, sort_keys=True) if args.json else attempt)
    return 0


def attach(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve(); run_path = root / args.attempt_id / "run.json"; run_record = load_json(run_path); strict(run_record, RUN_FIELDS, "run.json")
    prechange = Path(args.prechange_dir).resolve(); captures = [("workspace", prechange / "workspace"), ("detached", prechange / "detached")]
    values = {}
    for kind, path in captures:
        capture_record = load_json(path / "capture.json"); closure = load_json(path / "closure.json"); manifest = load_json(path / "file-manifest.json")
        if capture_record["capture_kind"] != kind or closure["capture_kind"] != kind or capture_record["commit_sha"] != run_record["requested_commit"] or capture_record["tree_sha"] != run_record["requested_tree"]:
            raise ValueError(f"{kind} capture does not bind to run")
        if capture_record["manifest_sha256"] != digest(path / "file-manifest.json") or capture_record["closure_sha256"] != digest(path / "closure.json") or closure["manifest_sha256"] != capture_record["manifest_sha256"]:
            raise ValueError(f"{kind} capture hash mismatch")
        if manifest.get("schema_version") != "prechange.v1":
            raise ValueError(f"{kind} manifest schema mismatch")
        values[kind] = capture_record
    run_record.update({"workspace_manifest_sha256": values["workspace"]["manifest_sha256"], "detached_baseline_manifest_sha256": values["detached"]["manifest_sha256"], "workspace_closure_sha256": values["workspace"]["closure_sha256"], "detached_baseline_closure_sha256": values["detached"]["closure_sha256"]})
    atomic_write(run_path, run_record)
    print(json.dumps(run_record, sort_keys=True) if args.json else args.attempt_id)
    return 0


def checkpoint(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve(); run_record = load_json(root / args.attempt_id / "run.json"); strict(run_record, RUN_FIELDS, "run.json")
    report_path = Path(args.report).resolve(); report = load_json(report_path); strict(report, REPORT_FIELDS, "report.json")
    if report["production_status"] == "GO":
        raise ValueError("final status is forbidden before seal")
    if not all(run_record[field] for field in ("workspace_manifest_sha256", "detached_baseline_manifest_sha256", "workspace_closure_sha256", "detached_baseline_closure_sha256")):
        raise ValueError("both prechange captures must be attached")
    if report["attempt_id"] != args.attempt_id or str(report["task_id"]) != str(args.task) or report["commit_sha"] != run_record["requested_commit"] or report["tree_sha"] != run_record["requested_tree"]:
        raise ValueError("report is unbound to canonical run")
    if report["evidence_class"] not in EVIDENCE_CLASSES or report["repository_status"] not in STATUSES or report["production_status"] not in STATUSES:
        raise ValueError("unknown evidence enum")
    expected_owner = VERIFIER_OWNERS.get(str(args.task))
    if expected_owner and (report["owner"] != expected_owner or report["producer"] != expected_owner):
        raise ValueError("report owner/producer does not match named verifier")
    provenance = report["provenance"]
    if not isinstance(provenance, dict) or not provenance.get("producer_identity") or not provenance.get("environment_identity") or not provenance.get("command_binding") or not provenance.get("artifact_digest"):
        raise ValueError("provenance trust anchor is incomplete")
    signature_type = provenance.get("signature_type")
    if report["evidence_class"] == "repository-static" and signature_type != "repository-commit":
        raise ValueError("repository evidence requires repository-commit provenance")
    if report["evidence_class"] in {"isolated-runtime", "operator-external-blocked"} and signature_type in {None, "repository-commit"}:
        raise ValueError("external evidence requires an independent trust anchor")
    if report["fresh_until"] < report["created_at"]:
        raise ValueError("invalid freshness")
    task_dir = root / args.attempt_id / f"task-{args.task}"; task_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_record = {"schema_version": SCHEMA, "attempt_id": args.attempt_id, "task_id": str(args.task), "report_sha256": digest(report_path), "input_manifest_sha256": report["file_manifest_sha256"], "checkpoint_status": "RECORDED", "created_at": now()}
    checkpoint_path = task_dir / "checkpoint.json"
    if checkpoint_path.exists():
        raise ValueError("duplicate checkpoint")
    atomic_write(checkpoint_path, checkpoint_record)
    print(json.dumps(checkpoint_record, sort_keys=True) if args.json else str(checkpoint_path))
    return 0


def barrier(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve(); run_record = load_json(root / args.attempt_id / "run.json"); strict(run_record, RUN_FIELDS, "run.json")
    if args.commit != run_record["requested_commit"] or args.tree != run_record["requested_tree"]:
        raise ValueError("barrier commit/tree must match canonical run")
    if args.coordinator != "release-coordinator":
        raise ValueError("barrier coordinator must be release-coordinator")
    try:
        deadline = datetime.fromisoformat(args.deadline.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("barrier deadline must be ISO-8601") from exc
    if deadline <= datetime.now(timezone.utc):
        raise ValueError("barrier deadline must be in the future")
    required = {"schema_version": "barrier.v1", "attempt_id": args.attempt_id, "coordinator_identity": args.coordinator, "final_commit": args.commit, "final_tree": args.tree, "deadline": args.deadline, "required_verifiers": REQUIRED_TASKS, "required_statuses": ["PASS", "BLOCKED_EXTERNAL"], "checkpoint_hashes": [], "created_at": now()}
    path = root / args.attempt_id / "barrier.json"
    if path.exists():
        raise ValueError("barrier already exists")
    atomic_write(path, required)
    print(json.dumps(required, sort_keys=True) if args.json else str(path))
    return 0


def aggregate(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve(); run_record = load_json(root / args.attempt_id / "run.json"); strict(run_record, RUN_FIELDS, "run.json")
    barrier_record = load_json(root / args.attempt_id / "barrier.json")
    if barrier_record.get("schema_version") != "barrier.v1" or barrier_record.get("attempt_id") != args.attempt_id or barrier_record.get("final_commit") != run_record["requested_commit"] or barrier_record.get("final_tree") != run_record["requested_tree"]:
        raise ValueError("invalid barrier binding")
    if barrier_record.get("coordinator_identity") != "release-coordinator" or barrier_record.get("required_verifiers") != REQUIRED_TASKS or barrier_record.get("required_statuses") != ["PASS", "BLOCKED_EXTERNAL"]:
        raise ValueError("barrier verifier contract mismatch")
    try:
        if datetime.fromisoformat(barrier_record["deadline"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
            raise ValueError("barrier deadline expired")
    except KeyError as exc:
        raise ValueError("barrier deadline missing") from exc
    checkpoints = []; missing = []; duplicate = []
    for task_id in REQUIRED_TASKS:
        paths = list((root / args.attempt_id).glob(f"**/task-{task_id}/checkpoint.json")) + list((root / args.attempt_id).glob(f"**/{task_id}/checkpoint.json"))
        if not paths:
            missing.append(task_id); continue
        if len(paths) != 1:
            duplicate.append(task_id); continue
        checkpoint_record = load_json(paths[0]); strict(checkpoint_record, CHECKPOINT_FIELDS, "checkpoint.json")
        if checkpoint_record["attempt_id"] != args.attempt_id or checkpoint_record["task_id"] != task_id or checkpoint_record["checkpoint_status"] != "RECORDED":
            raise ValueError(f"invalid checkpoint binding: {task_id}")
        if checkpoint_record["report_sha256"] != digest(paths[0].parent / "report.json"):
            raise ValueError(f"mutated report for checkpoint: {task_id}")
        report = load_json(paths[0].parent / "report.json"); strict(report, REPORT_FIELDS, "report.json")
        if report["attempt_id"] != args.attempt_id or report["task_id"] != task_id or report["commit_sha"] != run_record["requested_commit"] or report["tree_sha"] != run_record["requested_tree"]:
            raise ValueError(f"report binding mismatch: {task_id}")
        expected_owner = VERIFIER_OWNERS.get(task_id)
        if expected_owner and (report["owner"] != expected_owner or report["producer"] != expected_owner):
            raise ValueError(f"report owner mismatch: {task_id}")
        if report["repository_status"] not in STATUSES or report["production_status"] not in STATUSES or report["evidence_class"] not in EVIDENCE_CLASSES:
            raise ValueError(f"report enum mismatch: {task_id}")
        if report["fresh_until"] < report["created_at"]:
            raise ValueError(f"stale report: {task_id}")
        checkpoints.append({"task_id": task_id, "path": str(paths[0]), "sha256": digest(paths[0])})
    if barrier_record.get("checkpoint_hashes") and sorted(item["sha256"] for item in checkpoints) != sorted(item["sha256"] for item in barrier_record["checkpoint_hashes"]):
        raise ValueError("checkpoint hashes do not match barrier")
    aggregate_status = "FAIL" if missing or duplicate else "PASS"
    record = {"schema_version": "aggregate.v1", "attempt_id": args.attempt_id, "required_task_ids": REQUIRED_TASKS, "checkpoint_hashes": checkpoints, "missing_ids": missing, "duplicate_ids": duplicate, "late_replacements": [], "aggregate_status": aggregate_status, "created_at": now()}
    atomic_write(root / args.attempt_id / "aggregate.json", record)
    print(json.dumps(record, sort_keys=True) if args.json else str(root / args.attempt_id / "aggregate.json"))
    return 0 if aggregate_status == "PASS" else 2


def seal(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve(); run_record = load_json(root / args.attempt_id / "run.json"); strict(run_record, RUN_FIELDS, "run.json")
    if args.commit != run_record["requested_commit"] or args.tree != run_record["requested_tree"]:
        raise ValueError("seal commit/tree mismatch")
    if not args.matrix or not args.matrix.is_file():
        raise ValueError("seal requires a production gate matrix")
    aggregate_record = load_json(root / args.attempt_id / "aggregate.json")
    if aggregate_record.get("aggregate_status") != "PASS":
        raise ValueError("cannot seal incomplete aggregate")
    reports = []
    for item in aggregate_record["checkpoint_hashes"]:
        checkpoint_path = Path(item["path"]); report_path = checkpoint_path.parent / "report.json"; report = load_json(report_path); strict(report, REPORT_FIELDS, "report.json"); reports.append(report)
    repository_status = "FAIL" if any(report["repository_status"] == "FAIL" for report in reports) else "PASS"
    production_status = "GO" if repository_status == "PASS" and all(report["production_status"] == "GO" for report in reports) else "NO-GO"
    if any(report["production_status"] in {"BLOCKED_EXTERNAL", "INCONCLUSIVE", "NO-GO", "FAIL"} for report in reports):
        production_status = "NO-GO"
    canonical_manifest = {"run_sha256": digest(root / args.attempt_id / "run.json"), "aggregate_sha256": digest(root / args.attempt_id / "aggregate.json"), "checkpoint_hashes": aggregate_record["checkpoint_hashes"]}
    record = {"schema_version": "sealed.v1", "attempt_id": args.attempt_id, "recomputed_commit": args.commit, "recomputed_tree": args.tree, "aggregate_hash": digest(root / args.attempt_id / "aggregate.json"), "gate_matrix_path": str(args.matrix.resolve()), "gate_matrix_sha256": digest(args.matrix), "canonical_manifest_hash": hashlib.sha256(json.dumps(canonical_manifest, sort_keys=True).encode()).hexdigest(), "repository_status": repository_status, "production_status": production_status, "gate_decisions": [{"task_id": report["task_id"], "repository_status": report["repository_status"], "production_status": report["production_status"]} for report in reports], "sealed_at": now()}
    path = root / args.attempt_id / "sealed.json"
    if path.exists():
        raise ValueError("sealed output already exists")
    atomic_write(path, record)
    print(json.dumps(record, sort_keys=True) if args.json else str(path))
    return 0 if production_status == "GO" else 2


def verify_final(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve(); run_record = load_json(root / args.attempt_id / "run.json"); strict(run_record, RUN_FIELDS, "run.json"); sealed_path = root / args.attempt_id / "sealed.json"; sealed = load_json(sealed_path)
    if sealed.get("schema_version") != "sealed.v1" or sealed.get("attempt_id") != args.attempt_id or sealed.get("recomputed_commit") != run_record["requested_commit"] or sealed.get("recomputed_tree") != run_record["requested_tree"]:
        raise ValueError("sealed output binding mismatch")
    if sealed.get("aggregate_hash") != digest(root / args.attempt_id / "aggregate.json"):
        raise ValueError("sealed aggregate mutation detected")
    gate_matrix = Path(sealed.get("gate_matrix_path", ""))
    if not gate_matrix.is_file() or sealed.get("gate_matrix_sha256") != digest(gate_matrix):
        raise ValueError("sealed gate matrix mutation detected")
    aggregate_record = load_json(root / args.attempt_id / "aggregate.json")
    if aggregate_record.get("aggregate_status") != "PASS" or len(aggregate_record.get("checkpoint_hashes", [])) != len(REQUIRED_TASKS):
        raise ValueError("sealed aggregate is incomplete")
    for item in aggregate_record["checkpoint_hashes"]:
        checkpoint_path = Path(item["path"]); report_path = checkpoint_path.parent / "report.json"
        if item["sha256"] != digest(checkpoint_path):
            raise ValueError("sealed checkpoint mutation detected")
        report = load_json(report_path); strict(report, REPORT_FIELDS, "report.json")
        if report["attempt_id"] != args.attempt_id or report["commit_sha"] != run_record["requested_commit"] or report["tree_sha"] != run_record["requested_tree"]:
            raise ValueError("sealed report binding mismatch")
    canonical_manifest = {"run_sha256": digest(root / args.attempt_id / "run.json"), "aggregate_sha256": digest(root / args.attempt_id / "aggregate.json"), "checkpoint_hashes": aggregate_record["checkpoint_hashes"]}
    if sealed.get("canonical_manifest_hash") != hashlib.sha256(json.dumps(canonical_manifest, sort_keys=True).encode()).hexdigest():
        raise ValueError("sealed canonical manifest mutation detected")
    if sealed["repository_status"] not in {"PASS", "FAIL"} or sealed["production_status"] not in {"GO", "NO-GO"}:
        raise ValueError("sealed status enum invalid")
    print(json.dumps({"status": "PASS", "repository_status": sealed["repository_status"], "production_status": sealed["production_status"]}, sort_keys=True) if args.json else "PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["capture-workspace", "capture-detached", "create", "attach-prechange", "checkpoint", "create-barrier", "aggregate", "seal", "verify-final"])
    parser.add_argument("--root", type=Path, default=Path(os.environ.get("VNSHOP_EVIDENCE_ROOT", r"C:\Users\dangq\AppData\Local\Temp\vnshop-evidence")))
    parser.add_argument("--output", type=Path); parser.add_argument("--commit"); parser.add_argument("--tree-sha", dest="tree"); parser.add_argument("--repo", type=Path, default=Path.cwd()); parser.add_argument("--attempt-id"); parser.add_argument("--prechange-dir", type=Path); parser.add_argument("--task"); parser.add_argument("--report", type=Path); parser.add_argument("--coordinator", default="release-coordinator"); parser.add_argument("--deadline", default="2099-01-01T00:00:00Z"); parser.add_argument("--matrix", type=Path); parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "capture-workspace":
            if not args.output or not args.commit or not args.tree: raise ValueError("capture requires --output --commit --tree-sha")
            result = capture(args.repo.resolve(), args.output.resolve(), "workspace", args.commit, args.tree); print(json.dumps(result, sort_keys=True)); return 0
        if args.command == "capture-detached":
            if not args.output or not args.commit: raise ValueError("detached capture requires --output --commit")
            tree = args.tree or git(args.repo.resolve(), "rev-parse", f"{args.commit}^{{tree}}")
            result = capture(args.repo.resolve(), args.output.resolve(), "detached", args.commit, tree); print(json.dumps(result, sort_keys=True)); return 0
        if args.command == "create": return create(args)
        if args.command == "attach-prechange": return attach(args)
        if args.command == "checkpoint": return checkpoint(args)
        if args.command == "create-barrier":
            if not args.attempt_id or not args.commit or not args.tree: raise ValueError("create-barrier requires attempt, commit, and tree")
            return barrier(args)
        if args.command == "aggregate": return aggregate(args)
        if args.command == "seal":
            if not args.attempt_id or not args.commit or not args.tree: raise ValueError("seal requires attempt, commit, and tree")
            return seal(args)
        if args.command == "verify-final": return verify_final(args)
        raise ValueError(f"unsupported lifecycle command: {args.command}")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}), file=sys.stderr); return 2


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Canonical Todo 1 evidence lifecycle. All validation is fail-closed."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
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
}
RUN_FIELDS = {"attempt_id", "schema_version", "requested_commit", "requested_tree", "deployment_authority", "environment_identity", "created_at", "workspace_manifest_sha256", "detached_baseline_manifest_sha256", "workspace_closure_sha256", "detached_baseline_closure_sha256", "allowed_path_set_sha256"}
REPORT_FIELDS = {"schema_version", "task_id", "producer", "owner", "attempt_id", "commit_sha", "tree_sha", "evidence_class", "repository_status", "production_status", "commands", "inputs", "outputs", "telemetry", "business_reconciliation", "provenance", "created_at", "fresh_until", "file_manifest_sha256"}
CHECKPOINT_FIELDS = {"schema_version", "attempt_id", "task_id", "report_sha256", "input_manifest_sha256", "checkpoint_status", "created_at"}


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
    unexpected = [item for item in root.iterdir() if item.name != "prechange"]
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["capture-workspace", "capture-detached", "create", "attach-prechange", "checkpoint", "aggregate", "seal", "verify-final"])
    parser.add_argument("--root", type=Path, default=Path(os.environ.get("VNSHOP_EVIDENCE_ROOT", r"C:\Users\dangq\AppData\Local\Temp\vnshop-evidence")))
    parser.add_argument("--output", type=Path); parser.add_argument("--commit"); parser.add_argument("--tree-sha", dest="tree"); parser.add_argument("--repo", type=Path, default=Path.cwd()); parser.add_argument("--attempt-id"); parser.add_argument("--prechange-dir", type=Path); parser.add_argument("--task"); parser.add_argument("--report", type=Path); parser.add_argument("--json", action="store_true")
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
        raise ValueError(f"{args.command} is coordinator-owned and unavailable before final barrier")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}), file=sys.stderr); return 2


if __name__ == "__main__":
    raise SystemExit(main())

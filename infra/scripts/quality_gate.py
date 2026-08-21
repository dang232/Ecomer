#!/usr/bin/env python3
"""Deterministic F2 quality checks over workflows, scripts, manifests, and evidence."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import hashlib
from pathlib import Path


def run(name: str, command: list[str], cwd: Path) -> dict:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False)
    return {"name": name, "argv": command, "exit_code": result.returncode, "status": "PASS" if result.returncode == 0 else "FAIL", "stdout": result.stdout[-4000:], "stderr": result.stderr[-4000:]}


def inventory(label: str, root: Path, repo: Path) -> dict:
    """Recursively inventory every requested regular file and its digest."""
    if not root.exists() or not root.is_dir():
        return {"name": f"inventory-{label}", "status": "FAIL", "reason": "requested directory is missing", "files": []}
    files = sorted(path for path in root.rglob("*") if path.is_file() and not path.is_symlink())
    if not files:
        return {"name": f"inventory-{label}", "status": "FAIL", "reason": "requested directory is empty", "files": []}
    records = [{"path": str(path.resolve().relative_to(repo)).replace("\\", "/"), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in files]
    ignored = []
    for record in records:
        check = subprocess.run(["git", "check-ignore", "--no-index", "--", record["path"]], cwd=repo, capture_output=True, text=True, check=False)
        if check.returncode == 0:
            ignored.append(record["path"])
    if ignored:
        return {"name": f"inventory-{label}", "status": "FAIL", "reason": "requested input contains ignored files", "ignored": ignored, "files": records, "count": len(records)}
    return {"name": f"inventory-{label}", "status": "PASS", "files": records, "count": len(records)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--workflows", type=Path)
    parser.add_argument("--scripts", type=Path)
    parser.add_argument("--manifests", type=Path)
    parser.add_argument("--evidence-dir", type=Path)
    args = parser.parse_args()
    repo = args.repo.resolve()
    checks: list[dict] = []
    for label, path in (("workflows", args.workflows), ("scripts", args.scripts), ("manifests", args.manifests)):
        if path is None:
            checks.append({"name": f"inventory-{label}", "status": "FAIL", "reason": "requested path is required", "files": []})
            continue
        checks.append(inventory(label, (repo / path).resolve() if not path.is_absolute() else path.resolve(), repo))
    checks.append(run("sensitive-paths", ["node", "infra/scripts/validate-sensitive-paths.mjs"], repo))
    python = sys.executable
    checks.append(run("todo2-pytest", [python, "-m", "pytest", "infra/scripts/validate-k8s-release.test.py", "-q"], repo))
    checks.append(run("render-inventory", [python, "infra/scripts/render-inventory.py"], repo))
    checks.append(run("release-policy", [python, "infra/scripts/validate-k8s-release.py", "--environment", "prod"], repo))
    if args.evidence_dir:
        args.evidence_dir.mkdir(parents=True, exist_ok=True)
    scope_status = "NOT_EVALUATED"
    if args.evidence_dir:
        attempt_dir = args.evidence_dir.resolve()
        evidence_root = attempt_dir.parent.parent
        run_path = evidence_root / "run.json"
        prechange = evidence_root.parent / "prechange"
        allowed = prechange / "allowed-paths.txt"
        if run_path.is_file() and (prechange / "workspace" / "file-manifest.json").is_file() and (prechange / "detached" / "file-manifest.json").is_file() and allowed.is_file():
            run_record = json.loads(run_path.read_text(encoding="utf-8-sig"))
            scope = subprocess.run([sys.executable, "infra/scripts/scope_gate.py", "--repo", str(repo), "--workspace-manifest", str(prechange / "workspace" / "file-manifest.json"), "--detached-manifest", str(prechange / "detached" / "file-manifest.json"), "--allowed-paths", str(allowed), "--allowed-paths-sha256", run_record.get("allowed_path_set_sha256", ""), "--run-json", str(run_path)], cwd=repo, capture_output=True, text=True, check=False)
            checks.append({"name": "scope", "argv": scope.args, "exit_code": scope.returncode, "status": "PASS" if scope.returncode == 0 else "FAIL", "stdout": scope.stdout[-4000:], "stderr": scope.stderr[-4000:]})
            scope_status = "PASS" if scope.returncode == 0 else "FAIL"
    if scope_status == "NOT_EVALUATED":
        checks.append({"name": "scope-required", "status": "FAIL", "reason": "scope evaluation is mandatory"})
    repository_checks = [check for check in checks if check.get("name") not in {"release-policy"}]
    status = "PASS" if all(check.get("status") == "PASS" for check in repository_checks) else "FAIL"
    payload = {"schema_version": "quality-gate.v1", "repository_status": status, "production_status": "NO-GO", "scope_status": scope_status, "checks": checks}
    if args.evidence_dir:
        (args.evidence_dir / "quality-gate.json").write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(payload, sort_keys=True))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

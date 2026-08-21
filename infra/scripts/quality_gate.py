#!/usr/bin/env python3
"""Deterministic F2 quality checks over workflows, scripts, manifests, and evidence."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def run(name: str, command: list[str], cwd: Path) -> dict:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False)
    return {"name": name, "argv": command, "exit_code": result.returncode, "status": "PASS" if result.returncode == 0 else "FAIL", "stdout": result.stdout[-4000:], "stderr": result.stderr[-4000:]}


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
        if path is not None and not (repo / path).exists() and not path.exists():
            checks.append({"name": label, "status": "FAIL", "reason": "requested path is missing"})
    checks.append(run("sensitive-paths", ["node", "infra/scripts/validate-sensitive-paths.mjs"], repo))
    python = sys.executable
    checks.append(run("todo2-pytest", [python, "-m", "pytest", "infra/scripts/validate-k8s-release.test.py", "-q"], repo))
    checks.append(run("render-inventory", [python, "infra/scripts/render-inventory.py"], repo))
    checks.append(run("release-policy", [python, "infra/scripts/validate-k8s-release.py", "--environment", "prod"], repo))
    if args.evidence_dir:
        args.evidence_dir.mkdir(parents=True, exist_ok=True)
    scope_status = "NOT_EVALUATED"
    if args.evidence_dir:
        evidence_root = args.evidence_dir.resolve().parents[2]
        run_path = evidence_root / "run.json"
        prechange = evidence_root.parent / "prechange"
        allowed = prechange / "allowed-paths.txt"
        if run_path.is_file() and (prechange / "workspace" / "file-manifest.json").is_file() and (prechange / "detached" / "file-manifest.json").is_file() and allowed.is_file():
            run_record = json.loads(run_path.read_text(encoding="utf-8-sig"))
            scope = subprocess.run([sys.executable, "infra/scripts/scope_gate.py", "--workspace-manifest", str(prechange / "workspace" / "file-manifest.json"), "--detached-manifest", str(prechange / "detached" / "file-manifest.json"), "--allowed-paths", str(allowed), "--allowed-paths-sha256", run_record.get("allowed_path_set_sha256", "")], cwd=repo, capture_output=True, text=True, check=False)
            checks.append({"name": "scope", "argv": scope.args, "exit_code": scope.returncode, "status": "PASS" if scope.returncode == 0 else "FAIL", "stdout": scope.stdout[-4000:], "stderr": scope.stderr[-4000:]})
            scope_status = "PASS" if scope.returncode == 0 else "FAIL"
    repository_checks = [check for check in checks if check.get("name") not in {"release-policy"}]
    status = "PASS" if all(check.get("status") == "PASS" for check in repository_checks) else "FAIL"
    payload = {"schema_version": "quality-gate.v1", "repository_status": status, "production_status": "NO-GO", "scope_status": scope_status, "checks": checks}
    if args.evidence_dir:
        (args.evidence_dir / "quality-gate.json").write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(payload, sort_keys=True))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

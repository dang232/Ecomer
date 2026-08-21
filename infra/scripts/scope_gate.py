#!/usr/bin/env python3
"""Compare final paths with Todo 1's dual prechange captures and allowed set."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


DEFAULT_ALLOWED = {"infra/scripts/validate-k8s-release.py", "infra/scripts/validate-k8s-release.test.py", "infra/scripts/render-inventory.py", "infra/scripts/k8s-topology-contract.py", "infra/scripts/evidence_gate.py", "infra/scripts/plan_contract_check.py", "infra/scripts/quality_gate.py", "infra/scripts/scope_gate.py", "infra/evidence/production-gates.yaml"}


def load_entries(path: Path | None) -> dict[str, dict]:
    if not path:
        return {}
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    return {item["path"].replace("\\", "/"): item for item in value.get("entries", [])}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def verify_capture(manifest_path: Path | None, errors: list[str]) -> tuple[dict[str, dict], dict]:
    if not manifest_path:
        errors.append("workspace and detached manifests are required")
        return {}, {}
    capture_dir = manifest_path.parent
    try:
        manifest = load_json(manifest_path)
        capture = load_json(capture_dir / "capture.json")
        closure = load_json(capture_dir / "closure.json")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        errors.append(f"invalid capture: {exc}")
        return {}, {}
    actual_manifest_hash = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    actual_closure_hash = hashlib.sha256((capture_dir / "closure.json").read_bytes()).hexdigest()
    if capture.get("manifest_sha256") != actual_manifest_hash or closure.get("manifest_sha256") != actual_manifest_hash:
        errors.append(f"capture manifest hash mismatch: {manifest_path}")
    if capture.get("closure_sha256") != actual_closure_hash:
        errors.append(f"capture closure hash mismatch: {manifest_path}")
    if capture.get("commit_sha") != closure.get("commit_sha") or capture.get("tree_sha") != closure.get("tree_sha"):
        errors.append(f"capture commit/tree binding mismatch: {manifest_path}")
    return {item["path"].replace("\\", "/"): item for item in manifest.get("entries", [])}, {"capture": capture, "closure": closure}


def current_paths(repo: Path) -> list[str]:
    result = subprocess.run(["git", "status", "--porcelain=v1", "--untracked-files=all"], cwd=repo, capture_output=True, text=True, check=False)
    return [line[3:].split(" -> ")[-1].replace("\\", "/") for line in result.stdout.splitlines() if len(line) >= 4]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--workspace-manifest", type=Path)
    parser.add_argument("--detached-manifest", type=Path)
    parser.add_argument("--allowed-path-set", type=Path)
    parser.add_argument("--allowed-paths", type=Path)
    parser.add_argument("--allowed-paths-sha256")
    args = parser.parse_args()
    repo = args.repo.resolve()
    workspace = load_entries(args.workspace_manifest)
    detached = load_entries(args.detached_manifest)
    errors: list[str] = []
    workspace, workspace_meta = verify_capture(args.workspace_manifest, errors)
    detached, detached_meta = verify_capture(args.detached_manifest, errors)
    allowed = set(DEFAULT_ALLOWED)
    allowed.update({"infra/scripts/validate-k8s-release/__init__.py", "infra/scripts/validate-k8s-release/test.py"})
    if args.allowed_path_set:
        allowed = {line.strip().replace("\\", "/") for line in args.allowed_path_set.read_text(encoding="utf-8").splitlines() if line.strip()}
    if args.allowed_paths:
        allowed = {line.strip().replace("\\", "/") for line in args.allowed_paths.read_text(encoding="utf-8").splitlines() if line.strip()}
        if args.allowed_paths_sha256 and hashlib.sha256(args.allowed_paths.read_bytes()).hexdigest() != args.allowed_paths_sha256:
            errors.append("allowed-paths.txt hash mismatch")
    paths = sorted(set(current_paths(repo)))
    outside: list[str] = []
    mutated: list[str] = []
    classifications: dict[str, str] = {}
    for path in paths:
        original = workspace.get(path)
        final = {"path": path, "status": "  ", "sha256": hashlib.sha256((repo / path).read_bytes()).hexdigest()} if (repo / path).is_file() else {"path": path, "status": "??", "sha256": None}
        if original and original.get("status") != "  " and original.get("sha256") == final.get("sha256"):
            classifications[path] = "PREEXISTING_UNCHANGED"
            continue
        if path not in allowed:
            outside.append(path)
        if original and original.get("status") != "  " and original.get("sha256") != final.get("sha256"):
            mutated.append(path)
        classifications.setdefault(path, "ALLOWED_CHANGED" if path in allowed else "OUT_OF_SCOPE")
    errors.extend(f"out-of-scope path: {path}" for path in outside)
    errors.extend(f"pre-existing path mutated: {path}" for path in mutated)
    if workspace_meta.get("capture", {}).get("commit_sha") != detached_meta.get("capture", {}).get("commit_sha") or workspace_meta.get("capture", {}).get("tree_sha") != detached_meta.get("capture", {}).get("tree_sha"):
        errors.append("workspace and detached captures are not bound to the same commit/tree")
    payload = {"schema_version": "scope-gate.v1", "status": "PASS" if not errors else "FAIL", "repository_status": "PASS" if not errors else "FAIL", "production_status": "NO-GO", "errors": errors, "classifications": classifications, "workspace_manifest": str(args.workspace_manifest) if args.workspace_manifest else None, "detached_manifest": str(args.detached_manifest) if args.detached_manifest else None}
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())

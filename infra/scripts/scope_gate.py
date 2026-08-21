#!/usr/bin/env python3
"""Compare the complete final Git tree/worktree with authenticated captures."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


DEFAULT_ALLOWED = {"infra/scripts/validate-k8s-release.py", "infra/scripts/validate-k8s-release.test.py", "infra/scripts/render-inventory.py", "infra/scripts/k8s-topology-contract.py", "infra/scripts/evidence_gate.py", "infra/scripts/plan_contract_check.py", "infra/scripts/quality_gate.py", "infra/scripts/scope_gate.py", "infra/evidence/production-gates.yaml", "infra/scripts/test_todo2_contracts.py"}


def _sha(path: Path) -> str | None:
    if path.is_symlink() or not path.is_file():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_entries(path: Path | None) -> dict[str, dict]:
    if path is None:
        return {}
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    return {str(item["path"]).replace("\\", "/"): item for item in value.get("entries", [])}


def _capture(manifest_path: Path | None, errors: list[str]) -> tuple[dict[str, dict], dict]:
    if manifest_path is None:
        errors.append("workspace and detached manifests are required")
        return {}, {}
    directory = manifest_path.resolve().parent
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        capture = json.loads((directory / "capture.json").read_text(encoding="utf-8-sig"))
        closure = json.loads((directory / "closure.json").read_text(encoding="utf-8-sig"))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        errors.append(f"invalid capture {manifest_path}: {exc}")
        return {}, {}
    manifest_hash = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    closure_path = directory / "closure.json"
    closure_hash = hashlib.sha256(closure_path.read_bytes()).hexdigest()
    if capture.get("schema_version") != "capture.v1" or closure.get("schema_version") != "closure.v1":
        errors.append(f"capture schema mismatch: {manifest_path}")
    if capture.get("manifest_sha256") != manifest_hash or closure.get("manifest_sha256") != manifest_hash:
        errors.append(f"capture manifest hash mismatch: {manifest_path}")
    if capture.get("closure_sha256") != closure_hash:
        errors.append(f"capture closure hash mismatch: {manifest_path}")
    if capture.get("capture_kind") != manifest.get("capture_kind") or capture.get("capture_kind") != closure.get("capture_kind"):
        errors.append(f"capture kind mismatch: {manifest_path}")
    if capture.get("commit_sha") != closure.get("commit_sha") or capture.get("tree_sha") != closure.get("tree_sha"):
        errors.append(f"capture commit/tree mismatch: {manifest_path}")
    return {str(item["path"]).replace("\\", "/"): item for item in manifest.get("entries", [])}, {"capture": capture, "closure": closure, "manifest_sha256": manifest_hash, "closure_sha256": closure_hash}


def _git(repo: Path, *args: str) -> list[str]:
    result = subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True, check=False)
    if result.returncode:
        raise ValueError(result.stderr.strip() or "git command failed")
    return [line.replace("\\", "/") for line in result.stdout.splitlines() if line]


def final_entries(repo: Path) -> dict[str, dict]:
    paths = set(_git(repo, "ls-files")) | set(_git(repo, "ls-files", "--others", "--exclude-standard"))
    entries: dict[str, dict] = {}
    for path in paths:
        full = repo / path
        status = "SYMLINK" if full.is_symlink() else ("FILE" if full.is_file() else "MISSING")
        entries[path] = {"path": path, "status": status, "sha256": _sha(full)}
    return entries


def compare_entries(
    workspace: dict[str, dict],
    detached: dict[str, dict],
    final: dict[str, dict],
    allowed: set[str],
) -> tuple[list[str], dict[str, str]]:
    """Classify every captured/final path and return scope errors."""
    errors: list[str] = []
    classifications: dict[str, str] = {}
    all_paths = set(workspace) | set(detached) | set(final)
    for path in sorted(all_paths):
        original = workspace.get(path)
        baseline = detached.get(path)
        current = final.get(path, {"path": path, "status": "MISSING", "sha256": None})
        if original and original.get("status", "  ") != "  " and original.get("sha256") == current.get("sha256") and current.get("status") == "FILE":
            classifications[path] = "PREEXISTING_UNCHANGED"
            continue
        baseline_same = baseline is not None and baseline.get("sha256") == current.get("sha256") and current.get("status") == "FILE"
        workspace_same = original is not None and original.get("sha256") == current.get("sha256") and current.get("status") == "FILE"
        if baseline_same and workspace_same:
            classifications[path] = "UNCHANGED"
            continue
        if original and original.get("status", "  ") != "  " and workspace_same:
            classifications[path] = "PREEXISTING_UNCHANGED"
            continue
        if path not in allowed:
            errors.append(f"out-of-allowlist final tree/worktree change: {path}")
            classifications[path] = "OUT_OF_SCOPE"
        elif original and original.get("status", "  ") in {" M", "M ", "MM", " D", "D ", "A ", "AM"} and not workspace_same:
            errors.append(f"pre-existing path mutated: {path}")
            classifications[path] = "PREEXISTING_MUTATED"
        else:
            classifications[path] = "ALLOWED_CHANGED"
        prior_status = (original or baseline or {}).get("status")
        if (current.get("status") == "SYMLINK") != (prior_status == "SYMLINK"):
            errors.append(f"symlink-type change: {path}")
    return sorted(set(errors)), classifications


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--workspace-manifest", type=Path, required=True)
    parser.add_argument("--detached-manifest", type=Path, required=True)
    parser.add_argument("--allowed-path-set", type=Path)
    parser.add_argument("--allowed-paths", type=Path)
    parser.add_argument("--allowed-paths-sha256", required=True)
    parser.add_argument("--run-json", type=Path)
    args = parser.parse_args()
    repo = args.repo.resolve()
    errors: list[str] = []
    workspace, workspace_meta = _capture(args.workspace_manifest, errors)
    detached, detached_meta = _capture(args.detached_manifest, errors)
    if args.allowed_paths:
        allowed_bytes = args.allowed_paths.read_bytes()
        allowed = {line.strip().replace("\\", "/") for line in allowed_bytes.decode("utf-8-sig").splitlines() if line.strip()}
        if hashlib.sha256(allowed_bytes).hexdigest() != args.allowed_paths_sha256:
            errors.append("allowed-paths.txt hash mismatch")
    elif args.allowed_path_set:
        allowed_bytes = args.allowed_path_set.read_bytes()
        allowed = {line.strip().replace("\\", "/") for line in allowed_bytes.decode("utf-8-sig").splitlines() if line.strip()}
        if hashlib.sha256(allowed_bytes).hexdigest() != args.allowed_paths_sha256:
            errors.append("allowed-path-set hash mismatch")
    else:
        allowed = set(DEFAULT_ALLOWED)
        errors.append("authenticated allowed-path file is required")
    if args.run_json:
        run = json.loads(args.run_json.read_text(encoding="utf-8-sig"))
        for field, meta_key in (("workspace_manifest_sha256", "workspace"), ("detached_baseline_manifest_sha256", "detached"), ("workspace_closure_sha256", "workspace"), ("detached_baseline_closure_sha256", "detached")):
            actual = workspace_meta.get("manifest_sha256" if "manifest" in field else "closure_sha256") if meta_key == "workspace" else detached_meta.get("manifest_sha256" if "manifest" in field else "closure_sha256")
            if run.get(field) != actual:
                errors.append(f"run binding mismatch: {field}")
        if run.get("allowed_path_set_sha256") != args.allowed_paths_sha256:
            errors.append("run allowed-path hash mismatch")
    if workspace_meta.get("capture", {}).get("capture_kind") != "workspace" or detached_meta.get("capture", {}).get("capture_kind") != "detached":
        errors.append("both authenticated workspace and detached captures are required")
    if workspace_meta.get("capture", {}).get("commit_sha") != detached_meta.get("capture", {}).get("commit_sha") or workspace_meta.get("capture", {}).get("tree_sha") != detached_meta.get("capture", {}).get("tree_sha"):
        errors.append("workspace and detached captures are not bound to one commit/tree")
    final = final_entries(repo)
    scope_errors, classifications = compare_entries(workspace, detached, final, allowed)
    errors.extend(scope_errors)
    payload = {"schema_version": "scope-gate.v1", "status": "PASS" if not errors else "FAIL", "repository_status": "PASS" if not errors else "FAIL", "production_status": "NO-GO", "errors": sorted(set(errors)), "classifications": classifications}
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())

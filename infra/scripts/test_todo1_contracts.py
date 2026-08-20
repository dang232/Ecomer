from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from argparse import Namespace
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "infra/scripts/evidence_session.py"
BASELINE = ROOT / "infra/scripts/create-readiness-baseline.py"
RUNNER = ROOT / "infra/scripts/powershell-runner.py"
MATRIX = ROOT / "infra/scripts/qa-command-matrix.yaml"


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_workload_formula_is_exact():
    baseline = load_module(BASELINE, "todo1_baseline")
    result = baseline.validate_workload(ROOT / "infra/load-tests/workload-contract.yaml")
    assert result["recomputed_total"] == 20_000_000


def test_detached_capture_rejects_mismatched_identity(tmp_path):
    module = load_module(EVIDENCE, "todo1_evidence_identity")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    tree = subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], cwd=ROOT, text=True).strip()
    with pytest.raises(ValueError, match="identity"):
        module.capture(ROOT, tmp_path / "capture", "detached", "0" * 40, tree)
    with pytest.raises(ValueError, match="identity"):
        module.capture(ROOT, tmp_path / "capture-2", "detached", commit, "0" * 40)


def test_detached_capture_rejects_dirty_repository(tmp_path):
    module = load_module(EVIDENCE, "todo1_evidence_dirty")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    tree = subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], cwd=ROOT, text=True).strip()
    with pytest.raises(ValueError, match="clean"):
        module.capture(ROOT, tmp_path / "capture", "detached", commit, tree)


def test_baseline_rejects_production_before_git_or_network(tmp_path):
    result = subprocess.run([sys.executable, str(BASELINE), "--commit", "bad", "--tree-sha", "bad", "--target", "production", "--manifest", "infra/load-tests/workload-contract.yaml", "--output", str(tmp_path / "baseline.json")], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode != 0
    assert json.loads(result.stdout)["status"] == "FAIL"


def test_create_attach_checkpoint_requires_both_captures(tmp_path):
    root = tmp_path / "evidence"
    (root / "prechange" / "workspace").mkdir(parents=True)
    (root / "prechange" / "detached").mkdir(parents=True)
    created = subprocess.run([sys.executable, str(EVIDENCE), "create", "--root", str(root), "--json"], cwd=ROOT, text=True, capture_output=True)
    assert created.returncode == 0, created.stderr
    attempt = json.loads(created.stdout)["attempt_id"]
    attached = subprocess.run([sys.executable, str(EVIDENCE), "attach-prechange", "--attempt-id", attempt, "--prechange-dir", str(root / "prechange"), "--root", str(root)], cwd=ROOT, text=True, capture_output=True)
    assert attached.returncode != 0
    assert "capture" in attached.stderr.lower()


def test_runner_preserves_first_failure_and_skips_later_steps(tmp_path):
    matrix = tmp_path / "matrix.yaml"
    matrix.write_text("schema_version: qa-command-matrix.v1\ncases:\n  case:\n    - id: first\n      command: [python, -c, 'raise SystemExit(7)']\n      cwd: .\n    - id: later\n      command: [python, -c, 'raise SystemExit(0)']\n      cwd: .\n", encoding="utf-8")
    evidence = tmp_path / "evidence"
    result = subprocess.run([sys.executable, str(RUNNER), "--matrix", str(matrix), "--case", "case", "--attempt-id", "attempt", "--evidence-dir", str(evidence)], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 7
    payload = json.loads((evidence / "runner-result.json").read_text(encoding="utf-8"))
    assert payload["first_failure_code"] == 7
    assert payload["commands"][1]["outcome"] == "SKIPPED_DUE_TO_PRIOR_FAILURE"


def test_checkpoint_rejects_final_status_before_seal(tmp_path):
    root = tmp_path / "evidence"
    root.mkdir()
    created = subprocess.run([sys.executable, str(EVIDENCE), "create", "--root", str(root), "--json"], cwd=ROOT, text=True, capture_output=True)
    assert created.returncode == 0
    attempt = json.loads(created.stdout)["attempt_id"]
    run = json.loads((root / attempt / "run.json").read_text(encoding="utf-8"))
    report = {"schema_version": "evidence.v1", "task_id": "1", "producer": "runtime-qa-owner", "owner": "runtime-qa-owner", "attempt_id": attempt, "commit_sha": run["requested_commit"], "tree_sha": run["requested_tree"], "evidence_class": "repository-static", "repository_status": "PASS", "production_status": "GO", "commands": [], "inputs": [], "outputs": [], "telemetry": [], "business_reconciliation": {}, "provenance": {}, "created_at": "2026-08-20T00:00:00Z", "fresh_until": "2026-08-21T00:00:00Z", "file_manifest_sha256": "a" * 64}
    report_path = root / attempt / "task-1" / "report.json"
    report_path.parent.mkdir(parents=True)
    report_path.write_text(json.dumps(report), encoding="utf-8")
    checked = subprocess.run([sys.executable, str(EVIDENCE), "checkpoint", "--attempt-id", attempt, "--task", "1", "--report", str(report_path), "--root", str(root)], cwd=ROOT, text=True, capture_output=True)
    assert checked.returncode != 0
    assert "before seal" in checked.stderr


def test_lifecycle_barrier_aggregate_seal_verify_and_mutation_rejection(tmp_path):
    module = load_module(EVIDENCE, "todo1_lifecycle")
    root = tmp_path / "root"
    root.mkdir()
    run_path = root / "attempt" / "run.json"
    run_path.parent.mkdir()
    commit = "a" * 40
    tree = "b" * 40
    run = {"attempt_id": "attempt", "schema_version": "evidence.v1", "requested_commit": commit, "requested_tree": tree, "deployment_authority": "repository-commit", "environment_identity": {}, "created_at": "2026-08-20T00:00:00Z", "workspace_manifest_sha256": "1" * 64, "detached_baseline_manifest_sha256": "2" * 64, "workspace_closure_sha256": "3" * 64, "detached_baseline_closure_sha256": "4" * 64, "allowed_path_set_sha256": "5" * 64}
    module.atomic_write(run_path, run)
    module.barrier(Namespace(root=root, attempt_id="attempt", commit=commit, tree=tree, coordinator="release-coordinator", deadline="2099-01-01T00:00:00Z", json=False))
    for task_id in module.REQUIRED_TASKS:
        owner = module.VERIFIER_OWNERS[task_id]
        folder = root / "attempt" / (f"task-{task_id}" if task_id.isdigit() else f"final/{task_id}")
        folder.mkdir(parents=True)
        report = {"schema_version": "evidence.v1", "task_id": task_id, "producer": owner, "owner": owner, "attempt_id": "attempt", "commit_sha": commit, "tree_sha": tree, "evidence_class": "repository-static", "repository_status": "PASS", "production_status": "NO-GO", "commands": [], "inputs": [], "outputs": [], "telemetry": [], "business_reconciliation": {}, "provenance": {"producer_identity": owner, "environment_identity": {"isolated": True}, "command_binding": "test", "artifact_digest": "a" * 64, "signature_type": "repository-commit"}, "created_at": "2026-08-20T00:00:00Z", "fresh_until": "2099-01-01T00:00:00Z", "file_manifest_sha256": "a" * 64}
        report_path = folder / "report.json"
        module.atomic_write(report_path, report)
        checkpoint = {"schema_version": "evidence.v1", "attempt_id": "attempt", "task_id": task_id, "report_sha256": module.digest(report_path), "input_manifest_sha256": "a" * 64, "checkpoint_status": "RECORDED", "created_at": "2026-08-20T00:00:00Z"}
        module.atomic_write(folder / "checkpoint.json", checkpoint)
    assert module.aggregate(Namespace(root=root, attempt_id="attempt", json=False)) == 0
    matrix = root / "gates.yaml"
    matrix.write_text("schema_version: production-gates.v1\nmandatory: [gate]\nprovenance:\n  required: [producer_identity]\n", encoding="utf-8")
    assert module.seal(Namespace(root=root, attempt_id="attempt", commit=commit, tree=tree, matrix=matrix, json=False)) == 2
    assert module.verify_final(Namespace(root=root, attempt_id="attempt", json=False)) == 2
    sealed = module.load_json(root / "attempt" / "sealed.json")
    assert sealed["repository_status"] == "PASS"
    assert sealed["production_status"] == "NO-GO"
    with (root / "attempt" / "aggregate.json").open("a", encoding="utf-8") as handle:
        handle.write("mutated\n")
    with pytest.raises(ValueError, match="mutation"):
        module.verify_final(Namespace(root=root, attempt_id="attempt", json=False))


def test_matrix_has_all_coordinator_cases_and_explicit_allowlist_hash():
    module = load_module(EVIDENCE, "todo1_matrix")
    import yaml
    matrix = yaml.safe_load(MATRIX.read_text(encoding="utf-8"))
    assert set(matrix["cases"]) == {"task-1-happy", "task-1-negative", "task-2-happy", "task-2-negative", "task-3-happy", "task-3-negative", "task-4-happy", "task-4-negative", "task-5-happy", "task-5-negative", "task-6-happy", "task-6-negative", "task-7-happy", "task-7-negative", "F3", "F4"}
    assert len(module.ALLOWED_PATHS) > 10
    assert "*" not in "\n".join(module.ALLOWED_PATHS)


def test_matrix_uses_behavioral_commands_and_exact_paths():
    text = MATRIX.read_text(encoding="utf-8")
    assert "--help" not in text
    assert "fake echo" not in text.lower()
    assert "json.loads" not in text
    assert "provider-isolation-preflight.py" in text
    assert "scope_gate.py" in text
    assert "node, --check, infra/scripts/e2e-day.mjs" in text
    for path in ("infra/scripts/test_todo3_contracts.py", "infra/scripts/test_todo4_contracts.py", "infra/load-tests/dataset/manifest.yaml", "infra/load-tests/k6-10k-dau.js"):
        assert path in text


def test_timestamps_are_parsed_and_timezone_is_required():
    module = load_module(EVIDENCE, "todo1_timestamps")
    assert module.parse_timestamp("2026-08-20T00:00:00Z") < module.parse_timestamp("2026-08-21T00:00:00+00:00")
    with pytest.raises(ValueError):
        module.parse_timestamp("2026-08-20T00:00:00")

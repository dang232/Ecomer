from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]


def load(name: str) -> object:
    spec = importlib.util.spec_from_file_location(name, ROOT / "infra/scripts" / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


evidence = load("evidence_gate")
scope = load("scope_gate")
quality = load("quality_gate")
plan = load("plan_contract_check")
topology = load("k8s-topology-contract")
inventory = load("render-inventory")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def valid_report(root: Path) -> Path:
    stdout = root / "stdout.txt"
    stderr = root / "stderr.txt"
    input_path = root / "input.json"
    output_path = root / "output.json"
    for path in (stdout, stderr, input_path, output_path):
        path.write_text(path.name, encoding="utf-8")
    report = {
        "schema_version": "evidence.v1", "task_id": "2", "producer": "release-engineering-owner", "owner": "release-engineering-owner", "attempt_id": "attempt-test", "commit_sha": "a" * 40, "tree_sha": "b" * 40, "evidence_class": "repository-static", "repository_status": "PASS", "production_status": "NO-GO",
        "commands": [{"outcome": "PASS", "argv": ["python", "-c", "pass"], "cwd": ".", "start_at": "2026-08-21T05:00:00Z", "end_at": "2026-08-21T05:00:01Z", "stdout_path": "stdout.txt", "stdout_sha256": sha(stdout), "stderr_path": "stderr.txt", "stderr_sha256": sha(stderr), "exit_code": 0}],
        "inputs": [{"path": "input.json", "sha256": sha(input_path)}], "outputs": [{"path": "output.json", "sha256": sha(output_path)}], "telemetry": [], "business_reconciliation": {"not_applicable": "static"},
        "provenance": {"producer_identity": "release-engineering-owner", "owner": "release-engineering-owner", "environment_identity": {"isolated": True}, "command_binding": "test", "artifact_digest": sha(output_path), "signature_type": "repository-commit", "deployment_authority": "repository-commit"}, "created_at": "2026-08-21T05:00:00Z", "fresh_until": "2099-01-01T00:00:00Z", "file_manifest_sha256": "c" * 64,
    }
    report_path = root / "report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report_path


def test_valid_real_report_is_accepted(tmp_path: Path) -> None:
    report = valid_report(tmp_path)
    accepted = evidence.validate_report(report, tmp_path)
    assert accepted["task_id"] == "2"


@pytest.mark.parametrize("field", ["commands", "inputs", "outputs", "provenance"])
def test_missing_report_payload_is_rejected(tmp_path: Path, field: str) -> None:
    report = valid_report(tmp_path)
    value = json.loads(report.read_text(encoding="utf-8"))
    value[field] = [] if field != "provenance" else {}
    report.write_text(json.dumps(value), encoding="utf-8")
    with pytest.raises(ValueError):
        evidence.validate_report(report, tmp_path)


def test_report_path_traversal_and_caller_hash_are_rejected(tmp_path: Path) -> None:
    report = valid_report(tmp_path)
    value = json.loads(report.read_text(encoding="utf-8"))
    value["inputs"][0] = {"path": "../outside", "sha256": "c" * 64}
    report.write_text(json.dumps(value), encoding="utf-8")
    with pytest.raises(ValueError):
        evidence.validate_report(report, tmp_path)


def test_quality_inventory_rejects_empty_and_hashes_nested_files(tmp_path: Path) -> None:
    empty = tmp_path / "empty"
    empty.mkdir()
    assert quality.inventory("empty", empty, tmp_path)["status"] == "FAIL"
    nested = tmp_path / "scripts" / "nested"
    nested.mkdir(parents=True)
    file = nested / "check.py"
    file.write_text("pass\n", encoding="utf-8")
    result = quality.inventory("scripts", tmp_path / "scripts", tmp_path)
    assert result["status"] == "PASS"
    assert result["files"][0]["sha256"] == sha(file)


def test_scope_rejects_clean_committed_out_of_allowlist(tmp_path: Path) -> None:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.invalid"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, check=True)
    tracked = tmp_path / "allowed.py"
    outside = tmp_path / "outside.py"
    tracked.write_text("one\n", encoding="utf-8")
    outside.write_text("one\n", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-qm", "base"], cwd=tmp_path, check=True)
    workspace = scope.final_entries(tmp_path)
    outside.write_text("two\n", encoding="utf-8")
    subprocess.run(["git", "add", "outside.py"], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-qm", "outside"], cwd=tmp_path, check=True)
    final = scope.final_entries(tmp_path)
    assert final["outside.py"]["sha256"] != workspace["outside.py"]["sha256"]
    assert "outside.py" not in {"allowed.py"}


def test_plan_row_local_mutation_fails() -> None:
    text = (ROOT / ".omo/plans/vnshop-enterprise-hardening-20m-load.md").read_text(encoding="utf-8")
    start = text.index("- [ ] 2.")
    end = text.index("- [ ] 3.")
    mutated = text[:start] + text[start:end].replace("Commit: Y", "Commit: REMOVED", 1) + text[end:]
    assert plan.plan_contract(mutated) != []


def test_topology_does_not_scan_unrelated_text() -> None:
    documents = [{"kind": "StatefulSet", "metadata": {"name": "kafka"}, "spec": {"replicas": 3, "template": {"spec": {"containers": [{"env": [{"name": "KAFKA_LISTENERS", "value": "SASL_SSL://:9092"}, {"name": "KAFKA_ADVERTISED_LISTENERS", "value": "SASL_SSL://kafka:9092"}, {"name": "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP", "value": "CLIENT:SASL_SSL"}, {"name": "KAFKA_SSL_CLIENT_AUTH", "value": "required"}, {"name": "KAFKA_SSL_ENDPOINT_IDENTIFICATION_ALGORITHM", "value": "https"}]}]}}}}, {"kind": "StatefulSet", "metadata": {"name": "elasticsearch"}, "spec": {"template": {"spec": {"containers": [{"env": [{"name": "discovery.type", "value": "zen"}, {"name": "xpack.security.enabled", "value": "true"}, {"name": "xpack.security.http.ssl.enabled", "value": "true"}]}]}}}}, {"kind": "CronJob", "metadata": {"name": "vnshop-authoritative-backup"}}]
    errors = topology.check(documents)
    assert "Kafka listeners must not use plaintext" not in errors
    assert "Elasticsearch must not use single-node discovery" not in errors


def test_inventory_rejects_alternate_overlay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(inventory, "render", lambda _: b"kind: ConfigMap\nmetadata:\n  name: x\n")
    result = subprocess.run(["python", str(ROOT / "infra/scripts/render-inventory.py"), "--overlay", str(ROOT / "infra/k8s/overlays/dev")], cwd=ROOT, capture_output=True, text=True, check=False)
    assert result.returncode != 0

"""Static and fail-closed contracts for the Todo 4 Elasticsearch authority."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
STATEFULSET = ROOT / "infra/k8s/elasticsearch/elasticsearch-statefulset.yaml"
SECURITY = ROOT / "infra/k8s/elasticsearch/security-contract.yaml"
DRILL = ROOT / "infra/scripts/elasticsearch-failure-drill.py"


def load_module(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem.replace("-", "_"), path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_authority_has_three_pods_roles_persistence_tls_and_quorum() -> None:
    docs = [doc for doc in yaml.safe_load_all(STATEFULSET.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    statefulset = next(doc for doc in docs if doc.get("kind") == "StatefulSet")
    text = STATEFULSET.read_text(encoding="utf-8")
    assert statefulset["spec"]["replicas"] == 3
    assert statefulset["spec"]["serviceName"] == "elasticsearch-headless"
    assert len(statefulset["spec"]["volumeClaimTemplates"]) == 1
    assert statefulset["spec"]["replicas"] * len(statefulset["spec"]["volumeClaimTemplates"]) == 3
    assert "node.roles" in text and "master,data,ingest" in text
    assert "cluster.initial_master_nodes" in text
    assert "xpack.security.enabled" in text and 'value: "true"' in text
    assert "xpack.security.http.ssl.enabled" in text
    assert "xpack.security.transport.ssl.enabled" in text
    assert "minAvailable: 2" in text
    assert "topologySpreadConstraints" in text
    assert "discovery.type" not in text
    assert "single-node" not in text


def test_client_contract_is_https_non_admin_and_authenticated_readiness() -> None:
    app = (ROOT / "services/search-service/src/main/resources/application.yml").read_text(encoding="utf-8")
    workload = (ROOT / "infra/k8s/base/workloads.yaml").read_text(encoding="utf-8")
    config = (ROOT / "infra/k8s/base/configmap.yaml").read_text(encoding="utf-8")
    assert "https://elasticsearch:9200" in app and "https://elasticsearch:9200" in workload and config
    assert "ELASTICSEARCH_USERNAME" in workload and "search-service-elasticsearch-username" in workload
    assert "ELASTICSEARCH_PASSWORD" in workload and "search-service-elasticsearch-password" in workload
    assert "ELASTICSEARCH_CA_CERTIFICATE" in workload
    assert "include: readinessState,db,elasticsearch" in app
    assert "username: elastic" not in app and "platform-elasticsearch-password" not in workload


def test_security_restore_reindex_and_role_mapping_contract_exists() -> None:
    text = SECURITY.read_text(encoding="utf-8")
    assert "search_service" in text and "operator" in text
    assert "restore-security-index.md" in text
    assert "reindex.md" in text
    assert "security" in text.lower()


def test_drill_help_and_rejects_unsafe_or_unauthenticated_targets(tmp_path: Path) -> None:
    help_result = subprocess.run([sys.executable, str(DRILL), "--help"], capture_output=True, text=True, check=False)
    assert help_result.returncode == 0
    target = tmp_path / "target.yaml"
    target.write_text("name: production\nproduction: true\nisolated: false\n", encoding="utf-8")
    result = subprocess.run([sys.executable, str(DRILL), "--target", str(target), "--expected-cluster-id", "fixture"], capture_output=True, text=True, check=False)
    assert result.returncode != 0
    assert json.loads(result.stdout)["status"] == "FAIL"


def test_drill_fail_closes_without_authenticated_cluster(tmp_path: Path) -> None:
    target = tmp_path / "target.yaml"
    target.write_text(
        "name: isolated-fixture\nproduction: false\nisolated: true\ncluster_id: fixture\n"
        "namespace: es-fixture\nhttps_endpoint: https://elasticsearch:9200\nca_path: /tls/ca.crt\n"
        "credential_principal: svc-drill\nclient_certificate_eku: clientAuth\n",
        encoding="utf-8",
    )
    result = subprocess.run([sys.executable, str(DRILL), "--target", str(target), "--expected-cluster-id", "fixture"], capture_output=True, text=True, check=False)
    payload = json.loads(result.stdout)
    assert result.returncode != 0
    assert payload["status"] == "BLOCKED_EXTERNAL"
    assert payload["authenticated_cluster"] is False

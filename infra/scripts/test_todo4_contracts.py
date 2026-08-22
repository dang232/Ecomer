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
NETWORK = ROOT / "infra/k8s/base/network-policies.yaml"


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
    assert "index.number_of_shards" not in text
    assert "index.number_of_replicas" not in text
    env = {entry["name"]: entry for entry in next(doc for doc in docs if doc.get("kind") == "StatefulSet")["spec"]["template"]["spec"]["containers"][0]["env"] if isinstance(entry, dict) and "name" in entry}
    assert env["node.roles"]["value"] == "master,data,ingest"
    assert env["discovery.seed_hosts"]["value"] == "elasticsearch-0.elasticsearch-headless,elasticsearch-1.elasticsearch-headless,elasticsearch-2.elasticsearch-headless"
    assert env["network.publish_host"]["value"] == "$(POD_NAME).elasticsearch-headless"
    runtime_script = "\n".join(str(value) for value in next(doc for doc in docs if doc.get("kind") == "StatefulSet")["spec"]["template"]["spec"]["containers"][0]["args"])
    assert "docker-entrypoint.sh elasticsearch -E cluster.initial_master_nodes=elasticsearch-0,elasticsearch-1,elasticsearch-2" in runtime_script
    assert "global-*.st" in runtime_script
    assert "ES_SETTING_CLUSTER_INITIAL_MASTER_NODES" not in runtime_script
    assert "cluster.initial_master_nodes" not in "\n".join(f"{entry.get('name')}={entry.get('value', '')}" for entry in env.values())
    assert "ES_SETTING_CLUSTER_INITIAL_MASTER_NODES" not in text
    assert "cluster.initial.master.nodes" not in text
    assert "ELASTICSEARCH_ALLOW_NEW_CLUSTER" not in text
    assert "persistentVolumeClaimRetentionPolicy" in text
    assert "whenDeleted: Retain" in text and "whenScaled: Retain" in text
    assert "xpack.security.enabled" in text and 'value: "true"' in text
    assert "xpack.security.http.ssl.enabled" in text
    assert "xpack.security.transport.ssl.enabled" in text
    assert "minAvailable: 2" in text
    assert "topologySpreadConstraints" in text
    assert "discovery.type" not in text
    assert "single-node" not in text


def test_identity_init_is_memory_backed_distinct_and_pre_readiness() -> None:
    docs = [doc for doc in yaml.safe_load_all(STATEFULSET.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    statefulset = next(doc for doc in docs if doc.get("kind") == "StatefulSet")
    pod = statefulset["spec"]["template"]["spec"]
    init = next(container for container in pod["initContainers"] if container["name"] == "generate-file-realm")
    main = next(container for container in pod["containers"] if container["name"] == "elasticsearch")
    init_env = {entry["name"]: entry for entry in init["env"]}
    main_env = {entry["name"]: entry for entry in main["env"]}
    assert init["image"] == main["image"]
    assert set(init_env) >= {
        "ELASTICSEARCH_ELASTIC_PASSWORD",
        "ELASTICSEARCH_OPERATOR_PASSWORD",
        "ELASTICSEARCH_SEARCH_PASSWORD",
    }
    refs = {name: init_env[name]["valueFrom"]["secretKeyRef"]["key"] for name in init_env}
    assert len({refs["ELASTICSEARCH_ELASTIC_PASSWORD"], refs["ELASTICSEARCH_OPERATOR_PASSWORD"], refs["ELASTICSEARCH_SEARCH_PASSWORD"]}) == 3
    assert main_env["ELASTIC_PASSWORD"]["valueFrom"]["secretKeyRef"]["key"] == "platform-elasticsearch-elastic-password"
    assert main_env["ELASTICSEARCH_OPERATOR_PASSWORD"]["valueFrom"]["secretKeyRef"]["key"] == "platform-elasticsearch-operator-password"
    assert all("operator:${ELASTICSEARCH_OPERATOR_PASSWORD}" in " ".join(probe["exec"]["command"]) for probe in (main["startupProbe"], main["readinessProbe"]))
    assert all("https://${HOSTNAME}.elasticsearch-headless:9200" in " ".join(probe["exec"]["command"]) for probe in (main["startupProbe"], main["readinessProbe"]))
    volumes = {volume["name"]: volume for volume in pod["volumes"]}
    assert volumes["elasticsearch-config"]["emptyDir"]["medium"] == "Memory"
    assert {mount["name"] for mount in init["volumeMounts"]} >= {"elasticsearch-config", "elasticsearch-tls"}
    assert {mount["name"] for mount in main["volumeMounts"]} >= {"elasticsearch-config"}
    script = "\n".join(str(value) for value in init["args"])
    assert "elasticsearch-users useradd operator" in script
    assert "elasticsearch-users useradd search-service" in script
    assert "/identity/roles.yml" in script and "/identity/role_mapping.yml" in script
    assert "umask 077" in script and "test -s" in script
    assert "chmod 400 /identity/certs/ca.crt /identity/certs/tls.crt /identity/certs/tls.key" in script
    assert "cat /tls/ca.crt > /identity/certs/ca.crt" in script
    assert "cat /tls/tls.crt > /identity/certs/tls.crt" in script
    assert "cat /tls/tls.key > /identity/certs/tls.key" in script
    assert "cp -a" not in script


def validate_identity_contract(doc: dict) -> list[str]:
    errors: list[str] = []
    pod = doc.get("spec", {}).get("template", {}).get("spec", {})
    init = next((item for item in pod.get("initContainers", []) if item.get("name") == "generate-file-realm"), None)
    main = next((item for item in pod.get("containers", []) if item.get("name") == "elasticsearch"), None)
    if not isinstance(init, dict) or not isinstance(main, dict):
        return ["identity init and Elasticsearch main container are required"]
    if init.get("image") != main.get("image"):
        errors.append("identity init must use the Elasticsearch main image")
    init_env = {entry.get("name"): entry for entry in init.get("env", []) if isinstance(entry, dict)}
    expected = {
        "ELASTICSEARCH_ELASTIC_PASSWORD": "platform-elasticsearch-elastic-password",
        "ELASTICSEARCH_OPERATOR_PASSWORD": "platform-elasticsearch-operator-password",
        "ELASTICSEARCH_SEARCH_PASSWORD": "search-service-elasticsearch-password",
    }
    actual: dict[str, str] = {}
    for name, key in expected.items():
        ref = init_env.get(name, {}).get("valueFrom", {}).get("secretKeyRef", {})
        if ref.get("key") != key:
            errors.append(f"identity Secret ref drift: {name}")
        actual[name] = str(ref.get("key", ""))
    if len(set(actual.values())) != 3:
        errors.append("identity Secret refs must be distinct")
    volumes = {item.get("name"): item for item in pod.get("volumes", []) if isinstance(item, dict)}
    if volumes.get("elasticsearch-config", {}).get("emptyDir", {}).get("medium") != "Memory":
        errors.append("identity config volume must be memory-backed")
    init_mounts = {item.get("name"): item for item in init.get("volumeMounts", []) if isinstance(item, dict)}
    main_mounts = {item.get("name"): item for item in main.get("volumeMounts", []) if isinstance(item, dict)}
    if "elasticsearch-config" not in init_mounts or "elasticsearch-tls" not in init_mounts:
        errors.append("identity init mounts config and TLS volumes")
    if main_mounts.get("elasticsearch-config", {}).get("mountPath") != "/usr/share/elasticsearch/config":
        errors.append("main container must mount generated identity config")
    script = "\n".join(str(value) for value in init.get("args", []))
    roles_at = script.find("cat > /identity/roles.yml")
    operator_at = script.find("elasticsearch-users useradd operator")
    search_at = script.find("elasticsearch-users useradd search-service")
    if roles_at < 0:
        errors.append("roles.yml generation is required")
    if operator_at < 0 or search_at < 0 or roles_at > operator_at or roles_at > search_at:
        errors.append("roles.yml must be generated before file-realm users")
    if "/identity/users" not in script or "/identity/users_roles" not in script:
        errors.append("generated users and users_roles files must be checked")
    if "-r operator" not in script or "-r search_service" not in script:
        errors.append("file-realm user role assignments are incorrect")
    if "test -s" not in script or "stat -c" not in script:
        errors.append("generated identity files require non-empty restricted-mode checks")
    probes = [main.get(name, {}) for name in ("startupProbe", "readinessProbe")]
    if any("operator:${ELASTICSEARCH_OPERATOR_PASSWORD}" not in " ".join(probe.get("exec", {}).get("command", [])) for probe in probes):
        errors.append("startup and readiness probes must use operator password")
    if any("elastic:" in " ".join(probe.get("exec", {}).get("command", [])) for probe in probes):
        errors.append("probes must not use elastic user")
    return errors


def test_identity_contract_rejects_named_hostile_mutations() -> None:
    docs = [doc for doc in yaml.safe_load_all(STATEFULSET.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    source = next(doc for doc in docs if doc.get("kind") == "StatefulSet")
    baseline = validate_identity_contract(source)
    assert baseline == []
    mutations: dict[str, callable] = {
        "missing-init": lambda doc: doc["spec"]["template"]["spec"]["initContainers"].pop(0),
        "wrong-image": lambda doc: doc["spec"]["template"]["spec"]["initContainers"][0].update(image="busybox"),
        "reused-secret": lambda doc: doc["spec"]["template"]["spec"]["initContainers"][0]["env"][1]["valueFrom"]["secretKeyRef"].update(key="platform-elasticsearch-elastic-password"),
        "missing-password": lambda doc: doc["spec"]["template"]["spec"]["initContainers"][0]["env"].pop(2),
        "missing-memory-volume": lambda doc: doc["spec"]["template"]["spec"]["volumes"].pop(0),
        "missing-roles": lambda doc: doc["spec"]["template"]["spec"]["initContainers"][0]["args"].__setitem__(0, "test -s /identity/users"),
        "useradd-before-roles": lambda doc: doc["spec"]["template"]["spec"]["initContainers"][0]["args"].__setitem__(0, "elasticsearch-users useradd operator\ncat > /identity/roles.yml"),
        "wrong-operator-role": lambda doc: doc["spec"]["template"]["spec"]["initContainers"][0]["args"].__setitem__(0, "cat > /identity/roles.yml\nelasticsearch-users useradd operator -r search_service"),
        "probe-drift": lambda doc: doc["spec"]["template"]["spec"]["containers"][0]["readinessProbe"]["exec"]["command"].__setitem__(2, "--user elastic:${ELASTIC_PASSWORD}"),
        "search-admin": lambda doc: doc["spec"]["template"]["spec"]["initContainers"][0]["args"].__setitem__(0, "cat > /identity/roles.yml\nsearch_service: {cluster: [all], indices: [{names: ['*'], privileges: [all]}]}\nelasticsearch-users useradd operator -r operator\nelasticsearch-users useradd search-service -r search_service"),
    }
    for name, mutate in mutations.items():
        mutated = yaml.safe_load(yaml.safe_dump(source))
        mutate(mutated)
        assert mutated != source, name
        assert validate_identity_contract(mutated), name


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
    assert "http://elasticsearch" not in app


def test_security_restore_reindex_and_role_mapping_contract_exists() -> None:
    text = SECURITY.read_text(encoding="utf-8")
    assert "search_service" in text and "operator" in text
    assert "restore-security-index.md" in text
    assert "reindex.md" in text
    assert "security" in text.lower()
    assert "bootstrap-lifecycle.yml" in text
    assert "tls-contract.yml" in text
    assert "serverAuth" in text and "clientAuth" in text


def test_effective_network_policy_excludes_elasticsearch_from_broad_internal_allow() -> None:
    es_docs = [doc for doc in yaml.safe_load_all(STATEFULSET.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    statefulset = next(doc for doc in es_docs if doc.get("kind") == "StatefulSet")
    labels = statefulset["spec"]["template"]["metadata"]["labels"]
    base_docs = [doc for doc in yaml.safe_load_all(NETWORK.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    broad = next(doc for doc in base_docs if doc.get("metadata", {}).get("name") == "allow-vnshop-internal")
    assert labels["app.kubernetes.io/part-of"] != broad["spec"]["podSelector"]["matchLabels"]["app.kubernetes.io/part-of"]
    allow = next(doc for doc in es_docs if doc.get("metadata", {}).get("name") == "elasticsearch-allow-required")
    assert all(
        destination.get("namespaceSelector") != {}
        for rule in allow["spec"]["egress"]
        for destination in rule.get("to", [])
    )
    snapshot_allow = next(doc for doc in es_docs if doc.get("metadata", {}).get("name") == "elasticsearch-snapshot-allow")
    assert snapshot_allow["spec"]["podSelector"]["matchLabels"]["app.kubernetes.io/name"] == "elasticsearch-snapshot-contract"
    assert any(
        destination.get("podSelector", {}).get("matchLabels", {}).get("app.kubernetes.io/name") == "elasticsearch"
        and rule.get("ports") == [{"protocol": "TCP", "port": 9200}]
        for rule in snapshot_allow["spec"]["egress"]
        for destination in rule.get("to", [])
    )
    assert any(
        destination.get("podSelector", {}).get("matchLabels", {}).get("app.kubernetes.io/name") == "minio"
        and rule.get("ports") == [{"protocol": "TCP", "port": 9000}]
        for rule in allow["spec"]["egress"]
        for destination in rule.get("to", [])
    )


def test_snapshot_contract_verifies_repository_slm_and_security_state() -> None:
    docs = [doc for doc in yaml.safe_load_all(STATEFULSET.read_text(encoding="utf-8")) if isinstance(doc, dict)]
    job = next(doc for doc in docs if doc.get("kind") == "Job")
    script = "\n".join(str(value) for value in job["spec"]["template"]["spec"]["containers"][0]["args"])
    for endpoint in ("/_snapshot/", "/_slm/policy/", "/_security/user/operator", "/_security/user/search-service", "/_security/role/search_service", "/_security/role-mapping/search_service"):
        assert endpoint in script
    assert "echo snapshot repository registration" not in script


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

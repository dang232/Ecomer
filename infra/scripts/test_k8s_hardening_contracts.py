from __future__ import annotations

from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
INGRESS = ROOT / "infra/k8s/base/ingress/ingress-nginx-controller.yaml"
NETWORK = ROOT / "infra/k8s/base/network-policies.yaml"


def documents(path: Path) -> list[dict]:
    return [doc for doc in yaml.safe_load_all(path.read_text(encoding="utf-8")) if isinstance(doc, dict)]


def test_ingress_controller_is_non_escalating_and_uses_explicit_pull_policy() -> None:
    deployment = next(doc for doc in documents(INGRESS) if doc.get("kind") == "Deployment")
    container = next(item for item in deployment["spec"]["template"]["spec"]["containers"] if item["name"] == "controller")
    security = container["securityContext"]

    assert security["allowPrivilegeEscalation"] is False
    assert security["runAsNonRoot"] is True
    assert security["runAsUser"] == 101
    assert security["seccompProfile"] == {"type": "RuntimeDefault"}
    assert "ALL" in security["capabilities"]["drop"]
    assert "NET_BIND_SERVICE" in security["capabilities"]["add"]
    assert container["image"] == "registry.k8s.io/ingress-nginx/controller:v1.10.1"
    assert "@sha256:" not in container["image"]
    assert container["imagePullPolicy"] == "Always"


def test_ingress_controller_rbac_is_explicit_and_read_only_for_discovery() -> None:
    role = next(doc for doc in documents(INGRESS) if doc.get("kind") == "ClusterRole")
    rules = role["rules"]
    assert all(rule.get("apiGroups") != ["*"] for rule in rules)
    assert all(rule.get("resources") != ["*"] for rule in rules)
    assert all(rule.get("verbs") != ["*"] for rule in rules)

    discovery = next(rule for rule in rules if set(rule["resources"]) == {"configmaps", "endpoints", "nodes", "pods", "secrets", "namespaces"})
    assert set(discovery["verbs"]) == {"get", "list", "watch"}
    assert not any(
        rule.get("apiGroups") == [""]
        and resource in {"configmaps", "endpoints", "nodes", "pods", "secrets", "namespaces"}
        and any(verb in {"create", "update", "patch", "delete"} for verb in rule.get("verbs", []))
        for rule in rules
        for resource in rule.get("resources", [])
    )

    binding = next(doc for doc in documents(INGRESS) if doc.get("kind") == "ClusterRoleBinding")
    assert binding["subjects"] == [{"kind": "ServiceAccount", "name": "ingress-nginx", "namespace": "ingress-nginx"}]


def test_network_policies_do_not_reopen_same_namespace_without_ports() -> None:
    policies = documents(NETWORK)
    for policy in policies:
        spec = policy.get("spec", {})
        for direction in ("ingress", "egress"):
            for rule in spec.get(direction, []):
                assert rule.get("to") != [{"podSelector": {}}]
                assert rule.get("from") != [{"podSelector": {}}]
                if rule.get("to") or rule.get("from"):
                    assert rule.get("ports"), f"unbounded {direction} rule in {policy['metadata']['name']}"

    internal = next(policy for policy in policies if policy["metadata"]["name"] == "allow-vnshop-internal")
    assert all(destination.get("namespaceSelector") != {} for rule in internal["spec"].get("egress", []) for destination in rule.get("to", []))
    assert not any(
        destination.get("ipBlock", {}).get("cidr") == "0.0.0.0/0"
        for rule in internal["spec"].get("egress", [])
        for destination in rule.get("to", [])
    )


def test_network_policies_prove_external_ingress_destinations() -> None:
    policies = documents(NETWORK)
    expected = {
        "allow-ingress-to-frontend": ("vnshop-frontend", 8080),
        "allow-ingress-to-api-gateway": ("vnshop-api-gateway", 8080),
        "allow-ingress-to-minio": ("minio", 9000),
    }
    for name, (destination, port) in expected.items():
        policy = next(policy for policy in policies if policy["metadata"]["name"] == name)
        assert policy["spec"]["podSelector"] == {"matchLabels": {"app.kubernetes.io/name": destination}}
        assert policy["spec"]["ingress"] == [
            {
                "from": [
                    {
                        "namespaceSelector": {"matchLabels": {"kubernetes.io/metadata.name": "ingress-nginx"}},
                        "podSelector": {
                            "matchLabels": {
                                "app.kubernetes.io/name": "ingress-nginx",
                                "app.kubernetes.io/component": "controller",
                            }
                        },
                    }
                ],
                "ports": [{"protocol": "TCP", "port": port}],
            }
        ]

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


PACKAGE_DIR = Path(__file__).parent
TARGET = PACKAGE_DIR.parent / "validate-k8s-release.test.py"
__file__ = str(TARGET)
SPEC = importlib.util.spec_from_file_location("validate_k8s_release_todo2", PACKAGE_DIR.parent / "validate-k8s-release.py")
validator = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(validator)


def config(data: dict[str, str]) -> dict:
    return {"kind": "ConfigMap", "metadata": {"name": "vnshop-app-config"}, "data": data}


def ref(key: str) -> dict:
    return {"valueFrom": {"secretKeyRef": {"name": "vnshop-runtime-secrets", "key": key}}}


class Todo2ReleasePolicyTests(unittest.TestCase):
    def test_prod_rejects_zero_mutable_and_unsealed(self):
        docs = [config({"CARRIER_MODE": "stub", "KAFKA_SECURITY_PROTOCOL": "SASL_PLAINTEXT", "ELASTICSEARCH_URL": "http://elasticsearch:9200", "WEB_ORIGIN": "https://web.vnshop.example"}), {"kind": "SealedSecret", "spec": {"encryptedData": {}}}, {"kind": "Deployment", "spec": {"template": {"spec": {"containers": [{"image": "ghcr.io/vnshop/app:latest"}, {"image": "ghcr.io/vnshop/app@sha256:" + "0" * 64}]}}}}]
        text = "\n".join(validator.validate_release_policy(docs, "prod"))
        self.assertIn("stub", text)
        self.assertIn("SASL_PLAINTEXT", text)
        self.assertIn("HTTPS", text)
        self.assertIn("placeholder origin", text)
        self.assertIn("mutable platform image", text)
        self.assertIn("SealedSecret encryptedData", text)

    def test_dev_preserves_explicit_unresolved_flags(self):
        self.assertFalse(any("only permitted" in item for item in validator.validate_release_policy([], "dev", allow_unresolved=True, allow_unsealed=True)))

    def test_enabled_provider_requires_complete_sealedsecret_references(self):
        errors: list[str] = []
        validator.validate_enabled_provider_secret_refs([config({"STRIPE_ENABLED": "true"}), ref("payment-stripe-secret-key")], {"STRIPE_ENABLED": "true"}, errors)
        text = "\n".join(errors)
        self.assertIn("payment-stripe-publishable-key", text)
        self.assertIn("payment-stripe-webhook-secret", text)

    def test_disabled_provider_does_not_require_secrets(self):
        errors: list[str] = []
        validator.validate_enabled_provider_secret_refs([config({"STRIPE_ENABLED": "false"})], {"STRIPE_ENABLED": "false"}, errors)
        self.assertEqual(errors, [])

    def test_provider_reference_collector_handles_nested_secret_refs(self):
        self.assertEqual(validator.collect_secret_references([{"spec": {"template": {"spec": {"containers": [{"env": [ref("one"), ref("two")]}]}}}}]), {"one", "two"})

    def test_lock_rejects_missing_provenance_and_zero_digest(self):
        catalog = [{"id": f"service-{index}", "image": f"ghcr.io/vnshop/service-{index}"} for index in range(19)]
        artifacts = [{"id": item["id"], "image": item["image"], "digest": "sha256:" + "a" * 64, "sbom": "artifact://sbom", "provenance": "https://attestation", "provenanceVerified": True} for item in catalog]
        artifacts[0] = {"id": "service-0", "image": "ghcr.io/vnshop/service-0", "digest": validator.ZERO_DIGEST, "sbom": "", "provenance": "", "provenanceVerified": False}
        errors: list[str] = []
        validator.validate_lock({"sourceCommit": "a" * 40, "artifacts": artifacts}, {"deployables": catalog}, errors)
        text = "\n".join(errors)
        self.assertIn("non-placeholder", text)
        self.assertIn("sbom", text)
        self.assertIn("provenance", text)
        self.assertIn("verified", text)

    def test_lock_rejects_fake_provider_attestation(self):
        catalog = [{"id": f"service-{index}", "image": f"ghcr.io/vnshop/service-{index}"} for index in range(19)]
        artifacts = [{"id": item["id"], "image": item["image"], "digest": "sha256:" + "a" * 64, "sbom": "https://registry.example/sbom", "provenance": "https://registry.example/provenance", "provenanceVerified": True, "provenanceRecord": {"producer": "registry", "sourceCommit": "a" * 40, "artifactDigest": "sha256:" + "a" * 64, "attestationId": "fake"}} for item in catalog]
        errors: list[str] = []
        validator.validate_lock({"sourceCommit": "a" * 40, "artifacts": artifacts}, {"deployables": catalog}, errors)
        self.assertTrue(any("independent" in error for error in errors))

    def test_policy_rejects_prod_override_flags(self):
        self.assertTrue(any("only permitted for dev" in item for item in validator.validate_release_policy([], "prod", allow_unresolved=True)))

    def test_policy_rejects_unsafe_secondary_origin(self):
        errors = validator.validate_release_policy([config({"CORS_ORIGINS": "https://web.acme.test,https://localhost:3000"})], "prod")
        self.assertTrue(any("placeholder origin" in error for error in errors))

    def test_staging_rejects_placeholder_external_origin(self):
        errors = validator.validate_release_policy(
            [config({"PUBLIC_URL": "https://api.example.com"})], "staging"
        )
        self.assertTrue(any("placeholder origin" in error for error in errors))

    def test_missing_external_lock_is_reported(self):
        errors: list[str] = []
        validator.validate_release_lock_presence(
            "staging", None, allow_unresolved=False, errors=errors
        )
        self.assertEqual(errors, ["missing infra/release/locks/staging.json"])

    def test_dev_unresolved_lock_is_explicitly_allowed(self):
        errors: list[str] = []
        validator.validate_release_lock_presence(
            "dev", None, allow_unresolved=True, errors=errors
        )
        self.assertEqual(errors, [])

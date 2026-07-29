import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("validate-k8s-release.py")
SPEC = importlib.util.spec_from_file_location("validate_k8s_release", MODULE_PATH)
validator = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(validator)


def provider_reference(key: str) -> dict:
    return {
        "valueFrom": {
            "secretKeyRef": {
                "name": "vnshop-runtime-secrets",
                "key": key,
                "optional": True,
            }
        }
    }


class RequiredSecretKeysTest(unittest.TestCase):
    def test_disabled_optional_provider_keys_are_not_required(self):
        documents = [provider_reference("payment-vietqr-account-no"), provider_reference("payment-stripe-secret-key")]

        required = validator.collect_required_secret_keys(documents, {
            "VIETQR_ENABLED": "false", "STRIPE_ENABLED": "false"
        })

        self.assertEqual(set(), required)

    def test_enabled_provider_keys_are_required(self):
        documents = [provider_reference("payment-vietqr-account-no"), provider_reference("payment-vietqr-account-name")]

        required = validator.collect_required_secret_keys(documents, {"VIETQR_ENABLED": "true"})

        self.assertEqual({"payment-vietqr-account-no", "payment-vietqr-account-name"}, required)

    def test_normal_secret_reference_is_always_required(self):
        documents = [{"secretKeyRef": {"name": "vnshop-runtime-secrets", "key": "payment-service-db-password"}}]

        required = validator.collect_required_secret_keys(documents, {})

        self.assertEqual({"payment-service-db-password"}, required)


if __name__ == "__main__":
    unittest.main()

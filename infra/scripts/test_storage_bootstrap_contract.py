"""Regression checks for the browser-facing local object-storage boundary."""

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


class StorageBootstrapContractTest(unittest.TestCase):
    def test_compose_bootstrap_configures_cors_for_browser_upload_buckets(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")

        self.assertIn("MINIO_API_CORS_ALLOW_ORIGIN", compose)
        self.assertIn("http://localhost:3000,http://localhost:5173", compose)
        self.assertIn("local/vnshop-products", compose)
        self.assertIn("local/vnshop-avatars", compose)
        self.assertIn("mc anonymous set-json", compose)
        self.assertNotIn("mc anonymous set download", compose)

    def test_kubernetes_bootstrap_configures_the_same_cors_boundary(self) -> None:
        manifest = (ROOT / "infra" / "k8s" / "base" / "storage-bootstrap-job.yaml").read_text(
            encoding="utf-8"
        )

        platform = (ROOT / "infra" / "k8s" / "base" / "platform-services.yaml").read_text(
            encoding="utf-8"
        )
        base_config = (ROOT / "infra" / "k8s" / "base" / "configmap.yaml").read_text(
            encoding="utf-8"
        )

        self.assertNotIn("mc cors set", manifest)
        self.assertIn("MINIO_API_CORS_ALLOW_ORIGIN", platform)
        self.assertIn("MINIO_API_CORS_ALLOW_ORIGIN: http://frontend:8080", base_config)
        self.assertIn("VNSHOP_OBJECT_STORAGE_PUBLIC_ENDPOINT: https://storage.vnshop.invalid", base_config)
        self.assertNotIn("VNSHOP_OBJECT_STORAGE_PUBLIC_ENDPOINT: http://minio:9000", base_config)
        self.assertIn("local/vnshop-products", manifest)
        self.assertIn("local/vnshop-avatars", manifest)
        self.assertIn("mc anonymous set-json", manifest)
        self.assertNotIn("mc anonymous set download", manifest)
        self.assertIn("mc ilm rule add --expire-days 1 local/vnshop-video-uploads-tmp", manifest)


if __name__ == "__main__":
    unittest.main()

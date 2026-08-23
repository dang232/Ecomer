"""Regression checks for the browser-facing local object-storage boundary."""

from pathlib import Path
import json
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


def _embedded_policy(manifest: str, name: str) -> dict:
    match = re.search(rf"^  {re.escape(name)}\.json: \|\n    (.+)$", manifest, re.MULTILINE)
    if match is None:
        raise AssertionError(f"missing embedded {name} policy")
    return json.loads(match.group(1))


def _policy_permissions(policy: dict) -> set[tuple[str, str]]:
    return {
        (action, resource)
        for statement in policy["Statement"]
        for action in statement["Action"]
        for resource in statement["Resource"]
    }


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
        self.assertIn("MINIO_API_CORS_ALLOW_ORIGIN: https://web.vnshop.invalid", base_config)
        self.assertIn("VNSHOP_OBJECT_STORAGE_PUBLIC_ENDPOINT: https://storage.vnshop.invalid", base_config)
        self.assertNotIn("VNSHOP_OBJECT_STORAGE_PUBLIC_ENDPOINT: http://minio:9000", base_config)
        self.assertIn("local/vnshop-products", manifest)
        self.assertIn("local/vnshop-avatars", manifest)
        self.assertIn("mc anonymous set-json", manifest)
        self.assertNotIn("mc anonymous set download", manifest)
        self.assertIn("mc ilm rule add --expire-days 1 local/vnshop-video-uploads-tmp", manifest)

    def test_video_service_policies_are_scoped_to_their_runtime_operations(self) -> None:
        manifest = (ROOT / "infra" / "k8s" / "base" / "storage-bootstrap-job.yaml").read_text(
            encoding="utf-8"
        )

        moderator = _policy_permissions(_embedded_policy(manifest, "moderator"))
        self.assertEqual(
            moderator,
            {
                ("s3:GetObject", "arn:aws:s3:::vnshop-videos-staging/*"),
                ("s3:PutObject", "arn:aws:s3:::vnshop-videos/*"),
                ("s3:DeleteObject", "arn:aws:s3:::vnshop-videos-staging/*"),
            },
        )
        self.assertNotIn(("s3:GetObject", "arn:aws:s3:::vnshop-videos/*"), moderator)
        self.assertNotIn(("s3:DeleteObject", "arn:aws:s3:::vnshop-videos/*"), moderator)

        transcoder = _policy_permissions(_embedded_policy(manifest, "transcoder"))
        self.assertEqual(
            transcoder,
            {
                ("s3:GetObject", "arn:aws:s3:::vnshop-video-uploads-tmp/*"),
                ("s3:DeleteObject", "arn:aws:s3:::vnshop-video-uploads-tmp/*"),
                ("s3:PutObject", "arn:aws:s3:::vnshop-videos-staging/*"),
            },
        )
        self.assertFalse(any(resource.startswith("arn:aws:s3:::vnshop-videos/*") for _, resource in transcoder))

    def test_public_video_read_policy_remains_unchanged_and_staging_is_private(self) -> None:
        manifest = (ROOT / "infra" / "k8s" / "base" / "storage-bootstrap-job.yaml").read_text(
            encoding="utf-8"
        )
        public_videos = _embedded_policy(manifest, "public-videos")
        self.assertEqual(public_videos["Statement"][0]["Principal"], {"AWS": ["*"]})
        self.assertEqual(public_videos["Statement"][0]["Action"], ["s3:GetObject"])
        self.assertEqual(public_videos["Statement"][0]["Resource"], ["arn:aws:s3:::vnshop-videos/*"])
        self.assertNotIn("vnshop-videos-staging/*", json.dumps(public_videos))

    def test_legacy_backup_manifest_is_removed_and_authoritative_backup_is_encrypted(self) -> None:
        base = ROOT / "infra" / "k8s" / "base"
        self.assertFalse((base / "jobs" / "db-backup-cronjob.yaml").exists())
        kustomization = (base / "kustomization.yaml").read_text(encoding="utf-8")
        self.assertIn("- backup-jobs.yaml", kustomization)
        self.assertNotIn("db-backup-cronjob.yaml", kustomization)

        authoritative = (base / "backup-jobs.yaml").read_text(encoding="utf-8")
        self.assertIn("name: vnshop-authoritative-backup", authoritative)
        self.assertIn("--sse AES256", authoritative)
        self.assertNotIn("name: db-backup", authoritative)


if __name__ == "__main__":
    unittest.main()

"""Regression checks for the product-service local video staging mount."""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


class ProductVideoStagingContractTest(unittest.TestCase):
    def test_tmpfs_is_writable_by_the_non_root_product_service_user(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")

        match = re.search(
            r"VIDEO_UPLOAD_LOCAL_STAGING_DIR: /tmp/video-uploads(?P<body>.*?)(?=\n\s+deploy:)",
            compose,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(match, "product-service staging configuration is missing")
        body = match.group("body")
        self.assertIn("/tmp/video-uploads:size=6G", body)
        self.assertIn("uid=1000", body)
        self.assertIn("gid=1000", body)
        self.assertIn("mode=700", body)
        self.assertIn("noexec", body)


if __name__ == "__main__":
    unittest.main()

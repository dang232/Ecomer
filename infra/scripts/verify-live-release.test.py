import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("verify-live-release.py")
DIGEST = "sha256:" + "a" * 64
IMAGE = "ghcr.io/dang232/vnshop-frontend"


class VerifyLiveReleaseTest(unittest.TestCase):
    def run_verifier(self, image_id: str) -> tuple[subprocess.CompletedProcess[str], dict]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            lock = {
                "sourceCommit": "b" * 40,
                "artifacts": [{"id": "frontend", "image": IMAGE, "digest": DIGEST}],
            }
            deployments = {
                "items": [
                    {
                        "metadata": {"name": "vnshop-frontend", "labels": {"vnshop.io/artifact-id": "frontend"}},
                        "spec": {"template": {"spec": {"containers": [{"image": f"{IMAGE}@{DIGEST}"}]}}},
                    }
                ]
            }
            pods = {
                "items": [
                    {
                        "metadata": {"name": "vnshop-frontend-1", "labels": {"vnshop.io/artifact-id": "frontend"}},
                        "status": {
                            "containerStatuses": [
                                {"image": f"{IMAGE}@{DIGEST}", "imageID": image_id, "ready": True}
                            ]
                        },
                    }
                ]
            }
            for name, value in (("lock", lock), ("deployments", deployments), ("pods", pods)):
                (root / f"{name}.json").write_text(json.dumps(value), encoding="utf-8")
            report = root / "report.json"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--lock",
                    str(root / "lock.json"),
                    "--deployments",
                    str(root / "deployments.json"),
                    "--pods",
                    str(root / "pods.json"),
                    "--output",
                    str(report),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            return result, json.loads(report.read_text(encoding="utf-8"))

    def test_accepts_exact_ready_runtime_digest(self):
        result, report = self.run_verifier(f"docker-pullable://{IMAGE}@{DIGEST}")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(report["valid"])
        self.assertEqual(report["readyPods"], {"frontend": 1})

    def test_rejects_runtime_digest_drift(self):
        result, report = self.run_verifier(f"{IMAGE}@sha256:{'c' * 64}")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(report["valid"])
        self.assertTrue(any("live image id differs" in error for error in report["errors"]))


if __name__ == "__main__":
    unittest.main()

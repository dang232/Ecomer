"""Fail-closed contracts for the secure root Compose topology."""

from pathlib import Path
import subprocess
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "docker-compose.yml"
DEV = ROOT / "docker-compose.dev.yml"


class ComposeTopologyContractTest(unittest.TestCase):
    def _compose(self, *files: Path) -> dict:
        command = ["docker", "compose"]
        for file in files:
            command.extend(["-f", str(file)])
        command.extend(["config", "--format", "json"])
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        return __import__("json").loads(result.stdout)

    def test_base_is_gateway_frontend_only_and_has_no_debug(self) -> None:
        document = self._compose(BASE)
        published = {
            (service, str(port["published"]))
            for service, config in document["services"].items()
            for port in config.get("ports", [])
        }
        self.assertEqual(published, {("api-gateway", "8080"), ("frontend", "3000")})
        text = BASE.read_text(encoding="utf-8")
        self.assertNotIn("JAVA_TOOL_OPTIONS", text)
        self.assertNotIn("address=*:", text)

    def test_dev_overlay_is_explicit_and_loopback_only(self) -> None:
        document = self._compose(BASE, DEV)
        for service, config in document["services"].items():
            for port in config.get("ports", []):
                self.assertEqual(port.get("host_ip"), "127.0.0.1", f"{service}: {port}")
        for service, config in document["services"].items():
            options = config.get("environment", {})
            if isinstance(options, list):
                options = dict(item.split("=", 1) for item in options if "=" in item)
            if "JAVA_TOOL_OPTIONS" in options:
                self.assertIn("address=127.0.0.1:", options["JAVA_TOOL_OPTIONS"])

    def test_staging_harness_is_not_named_staging(self) -> None:
        staging = yaml.safe_load((ROOT / "infra/compose/staging/docker-compose.staging.yml").read_text(encoding="utf-8"))
        self.assertEqual(staging["name"], "vnshop-local-only-dev")
        self.assertEqual(staging["x-vnshop-environment"], "local-only-dev")


if __name__ == "__main__":
    unittest.main()

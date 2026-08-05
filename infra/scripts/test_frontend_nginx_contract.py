"""Static contract checks for the frontend's Docker-aware nginx proxy."""

from pathlib import Path
import unittest


REPO = Path(__file__).resolve().parents[2]
NGINX = REPO / "fe/nginx.conf"


class FrontendNginxContractTest(unittest.TestCase):
    def test_runtime_config_proxy_re_resolves_gateway_after_container_recreation(self) -> None:
        config = NGINX.read_text(encoding="utf-8")

        self.assertIn("resolver 127.0.0.11 valid=10s ipv6=off;", config)
        self.assertIn("set $config_gateway api-gateway:8080;", config)
        self.assertIn("proxy_pass http://$config_gateway/api/config/public;", config)


if __name__ == "__main__":
    unittest.main()

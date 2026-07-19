import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL;

if (!BASE_URL || !BASE_URL.startsWith("https://")) {
  throw new Error("BASE_URL must be an HTTPS origin");
}

export const options = {
  scenarios: {
    public_read_path: {
      executor: "constant-vus",
      vus: 10,
      duration: "60s",
      gracefulStop: "10s",
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<2000"],
  },
};

export default function () {
  const products = http.get(`${BASE_URL}/products`);
  check(products, { "products returns 2xx": (response) => response.status >= 200 && response.status < 300 });

  const search = http.get(`${BASE_URL}/search?q=ao`);
  check(search, { "search returns 2xx": (response) => response.status >= 200 && response.status < 300 });
  sleep(1);
}

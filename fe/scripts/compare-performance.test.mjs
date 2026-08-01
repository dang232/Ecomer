import assert from "node:assert/strict";
import test from "node:test";

import { comparePerformance } from "./compare-performance.mjs";

const validLighthouse = () => ({
  schemaVersion: 1,
  configuration: {
    viewport: "390x844",
    formFactor: "mobile",
    cpuSlowdown: 4,
    runsPerRoute: 3,
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      requestLatencyMs: 150,
      downloadThroughputKbps: 1638.4,
      uploadThroughputKbps: 750,
    },
  },
  routes: ["home", "search", "product", "cart", "checkout"].map((route) => ({
    route,
    url:
      route === "home" ? "/"
      : route === "search" ? "/search?q=phone"
      : route === "product" ? "/product/seeded-product"
      : `/${route}`,
    runs: Array.from({ length: 3 }, () => ({ lcpMs: 2_000, cls: 0.05 })),
    medianLcpMs: 2_000,
    medianCls: 0.05,
  })),
});
const validBundles = () => ({
  routes: Object.fromEntries(
    ["home", "search", "product", "cart", "checkout"].map((route) => [
      route,
      { gzipBytes: 100_000 },
    ]),
  ),
});

test("fails a route above ten percent gzip growth", () => {
  const current = validBundles();
  current.routes.home.gzipBytes = 111_000;
  const findings = comparePerformance(
    validBundles(),
    current,
    validLighthouse(),
  );
  assert.match(findings.join("\n"), /home gzip grew 11.0%/);
});

test("fails Lighthouse medians outside the release targets", () => {
  const lighthouse = validLighthouse();
  lighthouse.routes[0].runs = Array.from(
    { length: 3 },
    () => ({ lcpMs: 2_501, cls: 0.1 }),
  );
  lighthouse.routes[0].medianLcpMs = 2_501;
  lighthouse.routes[0].medianCls = 0.1;
  const findings = comparePerformance(
    validBundles(),
    validBundles(),
    lighthouse,
  );
  assert.match(findings.join("\n"), /LCP 2501ms/);
  assert.match(findings.join("\n"), /CLS 0.1/);
});

test("fails closed on missing routes, malformed runs, and wrong configuration", () => {
  const lighthouse = validLighthouse();
  lighthouse.configuration.formFactor = "desktop";
  lighthouse.routes.pop();
  lighthouse.routes[0].runs = [{ lcpMs: Number.NaN, cls: 0.05 }];
  const findings = comparePerformance(validBundles(), validBundles(), lighthouse);
  assert.match(findings.join("\n"), /mobile configuration/);
  assert.match(findings.join("\n"), /checkout is missing/);
  assert.match(findings.join("\n"), /exactly three finite runs/);
});

test("rejects relabeled URLs, duplicate routes, and altered network throttling", () => {
  const lighthouse = validLighthouse();
  lighthouse.configuration.throttling.rttMs = 0;
  lighthouse.routes[1].url = "/";
  lighthouse.routes[4] = { ...lighthouse.routes[0] };
  const findings = comparePerformance(validBundles(), validBundles(), lighthouse);
  assert.match(findings.join("\n"), /mobile configuration/);
  assert.match(findings.join("\n"), /exactly one result for each required route/);
  assert.match(findings.join("\n"), /search measured unexpected URL/);
});

test("rejects missing or extra bundle route labels", () => {
  const current = validBundles();
  delete current.routes.checkout;
  current.routes.account = { gzipBytes: 1 };
  const findings = comparePerformance(validBundles(), current, validLighthouse());
  assert.match(findings.join("\n"), /current bundle routes must exactly match/);
});

test("passes valid measurements within budget", () => {
  const findings = comparePerformance(
    validBundles(),
    validBundles(),
    validLighthouse(),
  );
  assert.equal(findings.length, 0);
});

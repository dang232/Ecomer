import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_ROUTES = ["home", "search", "product", "cart", "checkout"];
const routeUrlIsValid = {
  home: (url) => url === "/",
  search: (url) => url === "/search?q=phone",
  product: (url) => /^\/product\/[^/?#]+$/.test(url),
  cart: (url) => url === "/cart",
  checkout: (url) => url === "/checkout",
};

export function comparePerformance(baseline, current, lighthouse) {
  const findings = [];
  for (const [label, measurement] of [
    ["baseline", baseline],
    ["current", current],
  ]) {
    const routeKeys = Object.keys(measurement?.routes ?? {}).sort();
    if (
      routeKeys.length !== REQUIRED_ROUTES.length ||
      routeKeys.some((route, index) => route !== [...REQUIRED_ROUTES].sort()[index])
    ) {
      findings.push(`${label} bundle routes must exactly match the required route set`);
    }
  }
  for (const route of REQUIRED_ROUTES) {
    const before = baseline?.routes?.[route];
    if (!before || !Number.isFinite(before.gzipBytes) || before.gzipBytes <= 0) {
      findings.push(`${route} is missing or invalid in baseline route measurements`);
      continue;
    }
    const after = current?.routes?.[route];
    if (!after) {
      findings.push(`${route} is missing from current route measurements`);
      continue;
    }
    if (!Number.isFinite(after.gzipBytes) || after.gzipBytes <= 0) {
      findings.push(`${route} is invalid in current route measurements`);
      continue;
    }
    const growth = ((after.gzipBytes - before.gzipBytes) / before.gzipBytes) * 100;
    if (growth > 10) findings.push(`${route} gzip grew ${growth.toFixed(1)}%`);
  }
  const configuration = lighthouse?.configuration;
  const throttling = configuration?.throttling;
  if (
    lighthouse?.schemaVersion !== 1 ||
    configuration?.viewport !== "390x844" ||
    configuration?.formFactor !== "mobile" ||
    configuration?.cpuSlowdown !== 4 ||
    configuration?.runsPerRoute !== 3 ||
    throttling?.rttMs !== 150 ||
    throttling?.throughputKbps !== 1638.4 ||
    throttling?.requestLatencyMs !== 150 ||
    throttling?.downloadThroughputKbps !== 1638.4 ||
    throttling?.uploadThroughputKbps !== 750
  ) {
    findings.push("Lighthouse mobile configuration is required");
  }
  const routes = Array.isArray(lighthouse?.routes) ? lighthouse.routes : [];
  const labels = routes.map((route) => route?.route);
  if (
    routes.length !== REQUIRED_ROUTES.length ||
    new Set(labels).size !== REQUIRED_ROUTES.length ||
    labels.some((label) => !REQUIRED_ROUTES.includes(label))
  ) {
    findings.push("Lighthouse must contain exactly one result for each required route");
  }
  for (const required of REQUIRED_ROUTES) {
    const route = routes.find((candidate) => candidate?.route === required);
    if (!route) {
      findings.push(`${required} is missing from Lighthouse measurements`);
      continue;
    }
    if (!routeUrlIsValid[required](route.url)) {
      findings.push(`${required} measured unexpected URL ${String(route.url)}`);
      continue;
    }
    const finiteRuns =
      Array.isArray(route.runs) &&
      route.runs.length === 3 &&
      route.runs.every(
        (run) => Number.isFinite(run?.lcpMs) && Number.isFinite(run?.cls),
      );
    if (!finiteRuns) {
      findings.push(`${required} must contain exactly three finite runs`);
      continue;
    }
    const lcp = [...route.runs].map((run) => run.lcpMs).sort((a, b) => a - b)[1];
    const cls = [...route.runs].map((run) => run.cls).sort((a, b) => a - b)[1];
    if (route.medianLcpMs !== lcp || route.medianCls !== cls) {
      findings.push(`${required} medians do not match raw runs`);
      continue;
    }
    if (lcp > 2_500) findings.push(`${required} LCP ${lcp}ms exceeds 2500ms target`);
    if (cls >= 0.1) findings.push(`${required} CLS ${cls} meets or exceeds 0.1 threshold`);
  }
  return findings;
}

async function main() {
  const read = async (file) => JSON.parse(await readFile(path.join(feDir, file), "utf8"));
  const findings = comparePerformance(
    await read("performance/baseline/route-bundles.json"),
    await read("performance/current/route-bundles.json"),
    await read("performance/current/lighthouse-mobile.json"),
  );
  findings.forEach((finding) => console.error(finding));
  if (findings.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

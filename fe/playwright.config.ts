import { defineConfig, devices } from "@playwright/test";

import { validateCredentials } from "./e2e/modernization/_credentials";

/**
 * Playwright config for VNShop frontend smoke + buyer happy-path E2E.
 *
 * Prereqs:
 *  - Backend stack up (`docker compose --profile apps up -d`) with Keycloak
 *    realm `vnshop` seeded and the `vnshop-admin-api` client configured
 *    (`bash infra/scripts/setup-keycloak-admin-client.sh`).
 *  - Frontend reachable at VITE_E2E_BASE_URL — defaults to the dockerised FE
 *    at http://localhost:3000 so the suite exercises the production bundle.
 *    Set VITE_E2E_BASE_URL=http://localhost:5173 to run against `pnpm run dev`
 *    (and also unset E2E_SKIP_WEBSERVER so Playwright boots vite for you).
 */

const baseURL = process.env.VITE_E2E_BASE_URL ?? "http://localhost:3000";
const ingressIp = process.env.E2E_INGRESS_IP;
const releaseHosts = [
  "web.vnshop.invalid",
  "api.vnshop.invalid",
  "auth.vnshop.invalid",
  "storage.vnshop.invalid",
];
const hostResolverRules = ingressIp
  ? `MAP ${releaseHosts.map((host) => `${host} ${ingressIp}`).join(",MAP ")}`
  : undefined;
// The dockerised FE is already up; only auto-start a webServer when explicitly
// pointed at the dev port. Default behaviour: assume the stack is running.
const skipWebServer = process.env.E2E_SKIP_WEBSERVER !== undefined || baseURL.includes(":3000");

validateCredentials();

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Run sequentially. The dockerised gateway has resilience4j circuit
  // breakers + Redis rate limiters that trip under simultaneous register/
  // login bursts from multiple workers, surfacing as 405/503 noise that
  // looks like real bugs. One worker keeps the suite deterministic.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    [
      "json",
      {
        outputFile:
          process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ??
          "test-results/playwright-results.json",
      },
    ],
  ],
  snapshotPathTemplate:
    "{testDir}/modernization/__snapshots__/{projectName}/{arg}{ext}",
  use: {
    baseURL,
    ignoreHTTPSErrors: false,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: hostResolverRules
          ? { args: [`--host-resolver-rules=${hostResolverRules}`] }
          : {},
      },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : {
        command: "pnpm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

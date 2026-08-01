import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);
const { auditCredentials, findViolations } = await import("./check-e2e-credentials.mjs");

test("rejects an inline seeded login credential outside the central store", () => {
  const violations = findViolations(
    "catalog.spec.ts",
    `await request.post("/auth/login", { data: { username: "buyer1", password: "test" } });`,
  );

  assert.equal(violations.length > 0, true);
});

test("rejects a default seeded password in the shared login helper", () => {
  const violations = findViolations(
    "_auth.ts",
    `export async function loginViaOidc(page, username, password = "test") {}`,
  );

  assert.equal(violations.length > 0, true);
});

test("allows credentials resolved through the central persona store", () => {
  const violations = findViolations(
    "modernization/_credentials.ts",
    `buyer: { username: "buyer1", password: "test" },`,
  );

  assert.deepEqual(violations, []);
});

test("ignores seeded names in comments and route paths", () => {
  const violations = findViolations(
    "network-diagnostic.spec.ts",
    `
      /**
       * Logs in as seller1 for diagnostics.
       */
      await page.goto("/sellers/seller1");
    `,
  );

  assert.deepEqual(violations, []);
});

test("rejects seeded values filled into login inputs", () => {
  const violations = findViolations(
    "_auth.ts",
    `
      await page.locator("#username").fill("seller1");
      await page.locator("#password").fill("test");
    `,
  );

  assert.equal(violations.length, 2);
});

test("the credential-audit CLI executes the clean audit", async () => {
  const { stdout, stderr } = await execute(process.execPath, ["scripts/check-e2e-credentials.mjs"], {
    cwd: process.cwd(),
  });

  assert.equal(stderr, "");
  assert.match(stdout, /Credential audit PASSED/);
});

test("the checked-in E2E suite has no hard-coded seeded credentials", async () => {
  assert.deepEqual(await auditCredentials(), []);
});

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import test from "node:test";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const execute = promisify(execFile);
const { auditCredentials, findViolations } = await import("./check-e2e-credentials.mjs");

const credentialsModulePath = path.join(
  process.cwd(),
  "e2e",
  "modernization",
  "_credentials.ts",
);

async function loadCredentialsModule() {
  const source = await readFile(credentialsModulePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: credentialsModulePath,
  }).outputText;

  const tempPath = path.join(
    tmpdir(),
    `vnshop-e2e-credentials-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`,
  );
  await import("node:fs/promises").then(({ writeFile }) => writeFile(tempPath, transpiled, "utf8"));
  return import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`);
}

async function withEnv(overrides, run) {
  const keys = Object.keys(overrides);
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("rejects an inline seeded login credential outside the central store", () => {
  const violations = findViolations(
    "catalog.spec.ts",
    `await request.post("/auth/login", { data: { username: "buyer1", password: "test" } });`,
  );

  assert.equal(violations.length > 0, true);
});

test("rejects an inline seeded email alias outside the central store", () => {
  const violations = findViolations(
    "catalog.spec.ts",
    `await request.post("/auth/login", { data: { email: "buyer1@vnshop.local", password: "test" } });`,
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

test("rejects seeded email aliases passed into login helpers", () => {
  const violations = findViolations(
    "_auth.ts",
    `await loginViaOidc(page, "seller1@example.test", "test");`,
  );

  assert.equal(violations.length, 2);
});

test("local mode keeps all fallback personas when no declaration is provided", async () => {
  const credentials = await loadCredentialsModule();

  await withEnv(
    {
      E2E_RELEASE_CONTRACT: undefined,
      E2E_REQUIRED_PERSONAS: undefined,
    },
    async () => {
      assert.deepEqual(credentials.requiredPersonas(), ["buyer", "seller", "admin"]);
    },
  );
});

test("contract mode requires an explicit non-empty E2E_REQUIRED_PERSONAS declaration", async () => {
  const credentials = await loadCredentialsModule();

  await withEnv(
    {
      E2E_RELEASE_CONTRACT: "true",
      E2E_REQUIRED_PERSONAS: undefined,
    },
    async () => {
      assert.throws(
        () => credentials.requiredPersonas(),
        /E2E_RELEASE_CONTRACT=true requires E2E_REQUIRED_PERSONAS to declare at least one persona/,
      );
    },
  );
});

test("contract mode rejects an empty E2E_REQUIRED_PERSONAS declaration", async () => {
  const credentials = await loadCredentialsModule();

  await withEnv(
    {
      E2E_RELEASE_CONTRACT: "true",
      E2E_REQUIRED_PERSONAS: "   ",
    },
    async () => {
      assert.throws(
        () => credentials.requiredPersonas(),
        /E2E_RELEASE_CONTRACT=true requires E2E_REQUIRED_PERSONAS to declare at least one persona/,
      );
    },
  );
});

test("contract mode accepts an explicit persona declaration", async () => {
  const credentials = await loadCredentialsModule();

  await withEnv(
    {
      E2E_RELEASE_CONTRACT: "true",
      E2E_REQUIRED_PERSONAS: "buyer,seller",
      E2E_BUYER_USERNAME: "buyer-protected",
      E2E_BUYER_PASSWORD: "buyer-secret",
      E2E_SELLER_USERNAME: "seller-protected",
      E2E_SELLER_PASSWORD: "seller-secret",
    },
    async () => {
      assert.deepEqual(credentials.requiredPersonas(), ["buyer", "seller"]);
      credentials.validateCredentials();
    },
  );
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

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const script = join(process.cwd(), "scripts", "check-error-handling.mjs");

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}

test("accepts a single services flag without treating the flag as a path", () => {
  const root = mkdtempSync(join(tmpdir(), "check-error-handling-"));
  const javaDir = join(root, "services");
  mkdirSync(javaDir, { recursive: true });
  writeFileSync(join(javaDir, "ProductCatalogAdapter.java"), "class ProductCatalogAdapter { void f() { try {} catch (Exception e) {} } }");

  const result = run(["--services", javaDir]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /generic Java catch/);
});

test("accepts a single frontend flag and reports direct console logging", () => {
  const root = mkdtempSync(join(tmpdir(), "check-error-handling-"));
  const sourceDir = join(root, "fe", "src");
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(join(sourceDir, "bad.ts"), "console.error('no');");

  const result = run(["--frontend", root]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /direct console logging/);
});

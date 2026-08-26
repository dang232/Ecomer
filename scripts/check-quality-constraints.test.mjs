import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";

const script = path.join(process.cwd(), "scripts", "check-quality-constraints.mjs");

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}

function fixtureRoot(name) {
  const root = mkdtempSync(path.join(tmpdir(), `quality-constraints-${name}-`));
  const source = path.join(root, "src", "main", "java");
  mkdirSync(source, { recursive: true });
  return source;
}

test("passes a clean source root under the pure LOC limit", () => {
  const source = fixtureRoot("clean");
  writeFileSync(path.join(source, "Clean.java"), "final class Clean {\n  int value() { return 1; }\n}\n");

  const result = run(["--max-loc", "250", "--reject-generic-catches", "--source-root", path.dirname(path.dirname(path.dirname(source)))]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /QUALITY CONSTRAINTS PASSED/);
});

test("rejects a generic catch with a nonzero exit", () => {
  const source = fixtureRoot("catch");
  writeFileSync(path.join(source, "GenericCatch.java"), "final class GenericCatch { void run() { try {} catch (Exception error) {} } }\n");

  const result = run(["--reject-generic-catches", "--source-root", path.dirname(path.dirname(path.dirname(source)))]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /generic catch of Exception\/RuntimeException/);
});

test("rejects a source file over the configured pure LOC limit", () => {
  const source = fixtureRoot("loc");
  writeFileSync(path.join(source, "TooLarge.java"), `${Array.from({ length: 251 }, (_, index) => `int value${index} = ${index};`).join("\n")}\n`);

  const result = run(["--max-loc", "250", "--source-root", path.dirname(path.dirname(path.dirname(source)))]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /pure LOC 251 exceeds max 250/);
});

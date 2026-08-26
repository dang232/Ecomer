import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();

function run(script, args) {
  return spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], { encoding: "utf8" });
}

test("root Kafka generator delegates to the canonical artifact implementation", () => {
  const result = run("generate-kafka-acls.mjs", ["--check"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Kafka generated artifacts are current/);
});

test("root Kafka generator preserves fixture failures", () => {
  const result = run("generate-kafka-acls.mjs", ["--check", "--fixture", "missing-topic"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Kafka generated artifacts are stale/);
});

test("root Kafka scanner delegates to the canonical usage implementation", () => {
  const result = run("scan-kafka-usage.mjs", []);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Kafka usage scan passed/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "run-cutover-gate.ps1",
);

test("cutover gate exposes the immutable image and environment contract", async () => {
  const script = await readFile(scriptPath, "utf8");

  assert.match(
    script,
    /param\s*\([\s\S]*\[Parameter\(Mandatory(?:\s*=\s*\$true)?\)\][\s\S]*\$ImageReference/,
  );
  assert.match(
    script,
    /\[Parameter\(Mandatory(?:\s*=\s*\$true)?\)\][\s\S]*\$ExpectedSourceCommit/,
  );
  assert.match(script, /function\s+Invoke-Checked/);
  assert.match(script, /org\.opencontainers\.image\.revision/);
  assert.match(script, /function\s+Wait-HttpOk/);
  assert.match(script, /try\s*\{[\s\S]*finally\s*\{/);
  assert.match(script, /test:e2e:local-complete/);
  assert.match(script, /measure:lighthouse/);
});

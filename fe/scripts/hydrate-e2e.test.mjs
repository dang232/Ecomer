import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

import { collectSpecFiles } from "./hydrate-e2e.mjs";

test("collectSpecFiles recursively includes only Playwright spec files", async (context) => {
  const fixtureDir = await mkdtemp(path.join(tmpdir(), "vnshop-e2e-"));
  context.after(() => rm(fixtureDir, { force: true, recursive: true }));
  await mkdir(path.join(fixtureDir, "journey", "modernization"), { recursive: true });
  await Promise.all([
    writeFile(path.join(fixtureDir, "top-level.spec.ts"), "export {};\n"),
    writeFile(
      path.join(fixtureDir, "journey", "modernization", "deep.spec.ts"),
      "export {};\n",
    ),
    writeFile(path.join(fixtureDir, "journey", "helper.ts"), "export {};\n"),
    writeFile(path.join(fixtureDir, "journey", "ignored.spec.tsx"), "export {};\n"),
  ]);

  assert.deepEqual(
    collectSpecFiles(fixtureDir).map((file) => path.relative(fixtureDir, file)),
    [path.join("journey", "modernization", "deep.spec.ts"), "top-level.spec.ts"],
  );
});

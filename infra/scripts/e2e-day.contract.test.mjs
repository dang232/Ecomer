import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const SCRIPT = new URL("./e2e-day.mjs", import.meta.url);

test("day gate uses the fresh buyer phone for profile upsert", async () => {
  const source = await readFile(SCRIPT, "utf8");

  assert.match(source, /ctx\.buyerPhone\s*=\s*`\+849/);
  assert.match(source, /phone:\s*ctx\.buyerPhone/);
  assert.doesNotMatch(source, /phone:\s*"\+84900000001"/);
});

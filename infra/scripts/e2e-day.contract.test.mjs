import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const SCRIPT = new URL("./e2e-day.mjs", import.meta.url);
const SEED_MJS = new URL("./seed-demo.mjs", import.meta.url);
const SEED_SH = new URL("./seed-demo.sh", import.meta.url);

test("day gate uses the fresh buyer phone for profile upsert", async () => {
  const source = await readFile(SCRIPT, "utf8");

  assert.match(source, /ctx\.buyerPhone\s*=\s*`\+849/);
  assert.match(source, /phone:\s*ctx\.buyerPhone/);
  assert.doesNotMatch(source, /phone:\s*"\+84900000001"/);
});

test("day gate creates seller variants with complete parcel metadata", async () => {
  const source = await readFile(SCRIPT, "utf8");

  assert.match(
    source,
    /stockQuantity:\s*50,\s*parcel:\s*\{\s*weightGrams:\s*1000,\s*lengthCm:\s*30,\s*widthCm:\s*20,\s*heightCm:\s*10\s*\}/s,
  );
});

test("demo seeders create variants with complete parcel metadata", async () => {
  const [mjsSource, shSource] = await Promise.all([
    readFile(SEED_MJS, "utf8"),
    readFile(SEED_SH, "utf8"),
  ]);

  assert.match(mjsSource, /parcel:\s*\{\s*weightGrams:\s*1000,\s*lengthCm:\s*30,\s*widthCm:\s*20,\s*heightCm:\s*10\s*\}/s);
  assert.match(shSource, /parcel:\s*\{\s*weightGrams:\s*1000,\s*lengthCm:\s*30,\s*widthCm:\s*20,\s*heightCm:\s*10\s*\}/s);
});

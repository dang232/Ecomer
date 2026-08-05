import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

const script = path.resolve("scripts/measure-route-bundles.mjs");
const routeEntries = [
  "src/app/pages/HomePage.tsx",
  "src/app/pages/SearchPage.tsx",
  "src/app/pages/ProductPage.tsx",
  "src/app/pages/CartPage.tsx",
  "src/app/pages/checkout/index.ts",
];

function manifestFor(entries = routeEntries) {
  const manifest = {
    "index.html": { file: "assets/initial.js", isEntry: true, imports: ["shared"] },
    shared: { file: "assets/shared.js" },
  };
  for (const [index, entry] of entries.entries()) {
    manifest[entry] = { file: `assets/route-${index}.js`, imports: ["shared"] };
  }
  return manifest;
}

async function fixture(manifest = manifestFor(), missingAsset = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), "vnshop-bundle-"));
  const dist = path.join(root, "dist");
  const assets = path.join(dist, "assets");
  await mkdir(path.join(dist, ".vite"), { recursive: true });
  await mkdir(assets, { recursive: true });
  await writeFile(path.join(dist, ".vite", "manifest.json"), JSON.stringify(manifest));
  const names = Object.values(manifest)
    .map((entry) => entry.file)
    .filter((file) => file.endsWith(".js"));
  for (const file of names) {
    if (missingAsset && file.endsWith("route-0.js")) continue;
    await writeFile(path.join(dist, file), `console.log(${JSON.stringify(file)});\n`);
  }
  return { root, dist, output: path.join(root, "route-bundles.json") };
}

function measure({ dist, output }) {
  return execFileSync(process.execPath, [script, "--dist", dist, "--output", output], {
    cwd: path.resolve(),
    encoding: "utf8",
    stdio: "pipe",
  });
}

test("measures initial and lazy graphs without counting shared assets twice", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  measure(data);

  const result = JSON.parse(await readFile(data.output, "utf8"));
  const home = result.routes.home;
  assert.deepEqual(home.assets, ["initial.js", "route-0.js", "shared.js"]);
  const expected = ["assets/initial.js", "assets/route-0.js", "assets/shared.js"]
    .map((file) => gzipSync(`console.log(${JSON.stringify(file)});\n`).byteLength)
    .reduce((total, size) => total + size, 0);
  assert.equal(home.gzipBytes, expected);
  assert.equal(result.routes.checkout.assets.filter((name) => name === "shared.js").length, 1);
});

test("fails when the manifest has zero or multiple initial entries", async (t) => {
  for (const manifest of [
    { shared: { file: "assets/shared.js" } },
    {
      ...manifestFor(),
      "admin.html": { file: "assets/admin.js", isEntry: true },
    },
  ]) {
    const data = await fixture(manifest);
    t.after(() => rm(data.root, { recursive: true, force: true }));
    assert.throws(() => measure(data), /Expected one initial Vite entry/);
  }
});

test("fails for a missing manifest or JavaScript asset", async (t) => {
  const noManifest = await mkdtemp(path.join(os.tmpdir(), "vnshop-bundle-missing-"));
  t.after(() => rm(noManifest, { recursive: true, force: true }));
  assert.throws(
    () => measure({ dist: noManifest, output: path.join(noManifest, "result.json") }),
    /manifest\.json/,
  );

  const missingAsset = await fixture(manifestFor(), true);
  t.after(() => rm(missingAsset.root, { recursive: true, force: true }));
  assert.throws(() => measure(missingAsset), /Manifest asset is missing from dist/);
});

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function valueAfter(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

const distDir = path.resolve(feDir, valueAfter("--dist", "dist"));
const distAssets = path.join(distDir, "assets");
const output = path.resolve(
  feDir,
  valueAfter("--output", "performance/baseline/route-bundles.json"),
);
const manifest = JSON.parse(await readFile(path.join(distDir, ".vite", "manifest.json"), "utf8"));

const files = (await readdir(distAssets)).filter((name) => name.endsWith(".js")).sort();
const assets = [];
const byName = new Map();
for (const name of files) {
  const body = await readFile(path.join(distAssets, name));
  const measured = {
    name,
    bytes: body.byteLength,
    gzipBytes: gzipSync(body).byteLength,
    sha256: createHash("sha256").update(body).digest("hex"),
  };
  assets.push(measured);
  byName.set(name, measured);
}

const routeEntries = {
  home: "src/app/pages/HomePage.tsx",
  search: "src/app/pages/SearchPage.tsx",
  product: "src/app/pages/ProductPage.tsx",
  cart: "src/app/pages/CartPage.tsx",
  checkout: "src/app/pages/checkout/index.ts",
};
const appEntries = Object.entries(manifest)
  .filter(([, outputValue]) => outputValue.isEntry)
  .map(([key]) => key);
if (appEntries.length !== 1) {
  throw new Error(`Expected one initial Vite entry, found ${appEntries.length}`);
}
const [appEntry] = appEntries;

function collect(entryKey, visited = new Set()) {
  if (visited.has(entryKey)) return visited;
  visited.add(entryKey);
  for (const imported of manifest[entryKey]?.imports ?? []) collect(imported, visited);
  return visited;
}

const routes = Object.fromEntries(
  Object.entries(routeEntries).map(([route, entry]) => {
    const entryKey = Object.keys(manifest).find((key) => key === entry);
    if (!entryKey) throw new Error(`Missing Vite manifest entry for ${entry}`);
    const reachable = new Set([...collect(appEntry), ...collect(entryKey)]);
    const routeAssets = [...reachable].flatMap((key) => {
      const file = manifest[key]?.file;
      if (!file) throw new Error(`Manifest key ${key} has no output file`);
      if (!file.endsWith(".js")) return [];
      const asset = byName.get(path.basename(file));
      if (!asset) throw new Error(`Manifest asset is missing from dist: ${file}`);
      return [asset];
    });
    return [
      route,
      {
        entry,
        assets: routeAssets.map((asset) => asset.name).sort(),
        gzipBytes: routeAssets.reduce((total, asset) => total + asset.gzipBytes, 0),
      },
    ];
  }),
);

await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify({ generatedFrom: path.relative(feDir, distDir), routes, assets }, null, 2)}\n`,
);

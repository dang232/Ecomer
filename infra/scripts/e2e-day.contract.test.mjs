import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = new URL("./e2e-day.mjs", import.meta.url);
const SEED_MJS = new URL("./seed-demo.mjs", import.meta.url);
const SEED_SH = new URL("./seed-demo.sh", import.meta.url);
const SEED_MJS_PATH = fileURLToPath(SEED_MJS);

const TRUSTED_PARCEL = { weightGrams: 1000, lengthCm: 30, widthCm: 20, heightCm: 10 };

function runDemoSeeder(gateway) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SEED_MJS_PATH], {
      env: { ...process.env, GATEWAY: gateway, FORCE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function startCatalogGateway() {
  const products = new Map([
    ["SKU-IPH16-PM-256", { id: "iphone-id", parcel: null }],
    ["SKU-MBA-M4-13", { id: "macbook-id", parcel: null }],
    ["SKU-UNCHANGED", {
      id: "unchanged-id",
      parcel: { weightGrams: 2222, lengthCm: 44, widthCm: 33, heightCm: 22 },
    }],
  ]);
  const creates = [];
  const writes = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (request.method === "GET" && url.pathname === "/products") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ data: { totalElements: products.size, content: [...products].map(([sku, product]) => ({
        id: product.id,
        name: sku,
        variants: [{ sku, parcel: product.parcel }],
      })) } }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/auth/login") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ data: { accessToken: "seed-token" } }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/sellers/me/products") {
      let body = "";
      for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body);
      const variant = payload.variants?.[0];
      creates.push(payload);
      const existing = products.get(variant.sku);
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ data: { id: existing?.id ?? `${variant.sku}-id` } }));
      return;
    }
    if (request.method === "PUT" && url.pathname.endsWith("/publish")) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ data: {} }));
      return;
    }
    if (request.method === "PUT" && url.pathname.startsWith("/sellers/me/products/")) {
      const productId = url.pathname.split("/").at(-1);
      let body = "";
      for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body);
      const variant = payload.variants?.[0];
      writes.push({ productId, payload });
      const existing = [...products.entries()].find(([, product]) => product.id === productId);
      if (existing && variant?.parcel) {
        products.set(existing[0], { ...existing[1], parcel: variant.parcel });
      }
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ data: { id: productId } }));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  return { creates, products, server, writes };
}

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

test("rerunning the demo catalog backfills affected existing SKUs idempotently", async (t) => {
  const gateway = startCatalogGateway();
  t.after(() => gateway.server.close());
  await new Promise((resolve) => gateway.server.listen(0, "127.0.0.1", resolve));
  const address = gateway.server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const firstRun = await runDemoSeeder(baseUrl);
  const secondRun = await runDemoSeeder(baseUrl);

  assert.equal(firstRun.code, 0, `${firstRun.stdout}\n${firstRun.stderr}`);
  assert.equal(secondRun.code, 0, `${secondRun.stdout}\n${secondRun.stderr}`);
  assert.deepEqual(gateway.products.get("SKU-IPH16-PM-256")?.parcel, TRUSTED_PARCEL);
  assert.deepEqual(gateway.products.get("SKU-MBA-M4-13")?.parcel, TRUSTED_PARCEL);
  assert.deepEqual(gateway.products.get("SKU-UNCHANGED")?.parcel, {
    weightGrams: 2222,
    lengthCm: 44,
    widthCm: 33,
    heightCm: 22,
  });
  assert.equal(gateway.creates.length, 0);
  assert.equal(gateway.writes.some(({ productId }) => productId === "unchanged-id"), false);
  assert.equal(gateway.writes.some(({ payload }) => payload.variants?.[0]?.parcel === null), false);
  assert.equal(gateway.writes.length, 2);
  assert.deepEqual(gateway.writes.map(({ payload }) => payload.variants[0].parcel), [
    TRUSTED_PARCEL,
    TRUSTED_PARCEL,
  ]);
});

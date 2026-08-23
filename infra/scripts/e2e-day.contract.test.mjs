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
    ["iphone-id", {
      id: "iphone-id",
      name: "Existing iPhone Listing",
      description: "Seller-authored iPhone description",
      categoryId: "phones-custom",
      brand: "Apple Premium",
      tags: ["featured", "seller-pick"],
      variants: [
        {
          sku: "SKU-IPH16-PM-256",
          name: "256GB Graphite",
          priceAmount: 31990000,
          priceCurrency: "VND",
          imageUrl: "https://example.test/iphone-graphite.webp",
          stockQuantity: 10,
          parcel: null,
        },
        {
          sku: "SKU-IPH16-PM-512",
          name: "512GB Gold",
          priceAmount: 35990000,
          priceCurrency: "VND",
          imageUrl: "https://example.test/iphone-gold.webp",
          stockQuantity: 7,
          parcel: { weightGrams: 2222, lengthCm: 44, widthCm: 33, heightCm: 22 },
        },
      ],
      images: [
        { url: "https://example.test/iphone-front.webp", alt: "Front", sortOrder: 2 },
        { url: "https://example.test/iphone-back.webp", alt: "Back", sortOrder: 5 },
      ],
    }],
    ["macbook-id", {
      id: "macbook-id",
      name: "Existing MacBook Listing",
      description: "Seller-authored MacBook description",
      categoryId: "laptops-custom",
      brand: "Apple Studio",
      tags: ["work", "premium"],
      variants: [
        {
          sku: "SKU-MBA-M4-13",
          name: "13-inch Silver",
          priceAmount: 27490000,
          priceCurrency: "VND",
          imageUrl: "https://example.test/macbook-silver.webp",
          stockQuantity: 8,
          parcel: null,
        },
        {
          sku: "SKU-MBA-M4-15",
          name: "15-inch Midnight",
          priceAmount: 32490000,
          priceCurrency: "VND",
          imageUrl: "https://example.test/macbook-midnight.webp",
          stockQuantity: 4,
          parcel: { weightGrams: 3333, lengthCm: 45, widthCm: 34, heightCm: 12 },
        },
      ],
      images: [
        { url: "https://example.test/macbook-open.webp", alt: "Open", sortOrder: 1 },
        { url: "https://example.test/macbook-closed.webp", alt: "Closed", sortOrder: 4 },
      ],
    }],
    ["unchanged-id", {
      id: "unchanged-id",
      name: "Unchanged Product",
      description: "Already complete",
      categoryId: "other",
      brand: "Other Brand",
      tags: ["complete"],
      variants: [{
        sku: "SKU-UNCHANGED",
        name: "Default",
        priceAmount: 100,
        priceCurrency: "VND",
        imageUrl: "https://example.test/unchanged.webp",
        stockQuantity: 1,
        parcel: { weightGrams: 2222, lengthCm: 44, widthCm: 33, heightCm: 22 },
      }],
      images: [{ url: "https://example.test/unchanged.webp", alt: "Unchanged", sortOrder: 0 }],
    }],
  ]);
  const creates = [];
  const writes = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (request.method === "GET" && url.pathname === "/products") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ data: { totalElements: products.size, content: [...products.values()] } }));
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
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ data: { id: `${variant.sku}-id` } }));
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
      writes.push({ productId, payload });
      if (products.has(productId)) {
        products.set(productId, { id: productId, ...payload });
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
  const iphone = gateway.products.get("iphone-id");
  const macbook = gateway.products.get("macbook-id");
  assert.deepEqual(iphone?.variants[0].parcel, TRUSTED_PARCEL);
  assert.deepEqual(macbook?.variants[0].parcel, TRUSTED_PARCEL);
  assert.deepEqual(iphone?.variants[1], {
    sku: "SKU-IPH16-PM-512",
    name: "512GB Gold",
    priceAmount: 35990000,
    priceCurrency: "VND",
    imageUrl: "https://example.test/iphone-gold.webp",
    stockQuantity: 7,
    parcel: { weightGrams: 2222, lengthCm: 44, widthCm: 33, heightCm: 22 },
  });
  assert.deepEqual(macbook?.variants[1], {
    sku: "SKU-MBA-M4-15",
    name: "15-inch Midnight",
    priceAmount: 32490000,
    priceCurrency: "VND",
    imageUrl: "https://example.test/macbook-midnight.webp",
    stockQuantity: 4,
    parcel: { weightGrams: 3333, lengthCm: 45, widthCm: 34, heightCm: 12 },
  });
  assert.deepEqual(iphone && { name: iphone.name, description: iphone.description, categoryId: iphone.categoryId, brand: iphone.brand, images: iphone.images, tags: iphone.tags }, {
    name: "Existing iPhone Listing",
    description: "Seller-authored iPhone description",
    categoryId: "phones-custom",
    brand: "Apple Premium",
    images: [
      { url: "https://example.test/iphone-front.webp", alt: "Front", sortOrder: 2 },
      { url: "https://example.test/iphone-back.webp", alt: "Back", sortOrder: 5 },
    ],
    tags: ["featured", "seller-pick"],
  });
  assert.deepEqual(macbook && { name: macbook.name, description: macbook.description, categoryId: macbook.categoryId, brand: macbook.brand, images: macbook.images, tags: macbook.tags }, {
    name: "Existing MacBook Listing",
    description: "Seller-authored MacBook description",
    categoryId: "laptops-custom",
    brand: "Apple Studio",
    images: [
      { url: "https://example.test/macbook-open.webp", alt: "Open", sortOrder: 1 },
      { url: "https://example.test/macbook-closed.webp", alt: "Closed", sortOrder: 4 },
    ],
    tags: ["work", "premium"],
  });
  assert.deepEqual(gateway.products.get("unchanged-id")?.variants[0].parcel, {
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

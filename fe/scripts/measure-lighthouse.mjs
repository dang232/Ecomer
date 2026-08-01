import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { z } from "zod";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appURL = process.env.VITE_E2E_BASE_URL ?? "http://localhost:3000";
const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const buyerUsername = process.env.E2E_BUYER_USERNAME;
const buyerPassword = process.env.E2E_BUYER_PASSWORD;
if (!buyerUsername || !buyerPassword) {
  throw new Error(
    "Performance measurement requires E2E_BUYER_USERNAME and E2E_BUYER_PASSWORD",
  );
}
const outputIndex = process.argv.indexOf("--output");
const output = path.resolve(
  feDir,
  outputIndex === -1
    ? "performance/baseline/lighthouse-mobile.json"
    : process.argv[outputIndex + 1],
);
const values = [];
const chrome = await launch({ chromeFlags: ["--headless", "--no-sandbox"] });

try {
  const productResponse = await fetch(`${apiURL}/products?size=1`);
  if (!productResponse.ok) {
    throw new Error(`Cannot resolve a seeded product: HTTP ${productResponse.status}`);
  }
  const productPayload = z
    .object({
      data: z.object({
        content: z.array(z.object({ id: z.string().min(1) })).min(1),
      }),
    })
    .parse(await productResponse.json());
  const productPath = `/product/${encodeURIComponent(productPayload.data.content[0].id)}`;
  const routes = ["/", "/search?q=phone", productPath, "/cart", "/checkout"];

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Chrome did not expose a default browser context");
  const setupPage = await context.newPage();
  await setupPage.goto(`${appURL}/login`);
  await setupPage.locator("#username").fill(buyerUsername);
  await setupPage.locator("#password").fill(buyerPassword);
  await setupPage
    .getByRole("button", {
      name: /sign in|continue to sign in|\u0111\u0103ng nh\u1eadp/i,
    })
    .click();
  await setupPage.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await setupPage.goto(`${appURL}/cart`);
  const removeButtons = setupPage.getByRole("button", {
    name: /remove .* from cart|x\u00f3a .* gi\u1ecf/i,
  });
  const emptyCart = setupPage.getByRole("heading", {
    name: /cart is empty|gi\u1ecf h\u00e0ng tr\u1ed1ng/i,
  });
  await expect
    .poll(async () => (await removeButtons.count()) + (await emptyCart.count()))
    .toBeGreaterThan(0);
  for (let removed = 0; (await removeButtons.count()) > 0; removed += 1) {
    if (removed >= 100) throw new Error("Cart reset exceeded 100 items");
    await Promise.all([
      setupPage.waitForResponse(
        (response) =>
          response.url().includes("/cart/items/") &&
          response.request().method() === "DELETE" &&
          response.ok(),
      ),
      removeButtons.first().click(),
    ]);
  }
  const hydratedCart = setupPage.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return url.pathname === "/cart" && response.request().method() === "GET" && response.ok();
    },
    { timeout: 30_000 },
  );
  await setupPage.goto(`${appURL}${productPath}`);
  await hydratedCart;
  const [cartResponse] = await Promise.all([
    setupPage.waitForResponse(
      (response) =>
        response.url().includes("/cart/items") && response.request().method() === "POST",
    ),
    setupPage
      .getByRole("button", { name: /add to cart|th\u00eam v\u00e0o gi\u1ecf/i })
      .first()
      .click(),
  ]);
  if (!cartResponse.ok()) {
    throw new Error(`Could not add the baseline product to cart: HTTP ${cartResponse.status()}`);
  }
  await setupPage.close();

  for (const route of routes) {
    const runs = [];
    for (let index = 0; index < 3; index += 1) {
      const result = await lighthouse(`${appURL}${route}`, {
        port: chrome.port,
        output: "json",
        onlyCategories: ["performance"],
        disableStorageReset: true,
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 1,
          disabled: false,
        },
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          requestLatencyMs: 150,
          downloadThroughputKbps: 1638.4,
          uploadThroughputKbps: 750,
          cpuSlowdownMultiplier: 4,
        },
      });
      const audits = result?.lhr.audits;
      if (!audits) throw new Error(`Lighthouse returned no audits for ${route}`);
      runs.push({
        lcpMs: audits["largest-contentful-paint"].numericValue,
        cls: audits["cumulative-layout-shift"].numericValue,
      });
    }
    const median = (items, key) => items.map((item) => item[key]).sort((a, b) => a - b)[1];
    const routeId =
      route === "/"
        ? "home"
        : route.startsWith("/search")
          ? "search"
          : route.startsWith("/product/")
            ? "product"
            : route.slice(1);
    values.push({
      route: routeId,
      url: route,
      runs,
      medianLcpMs: median(runs, "lcpMs"),
      medianCls: median(runs, "cls"),
    });
  }
} finally {
  try {
    await chrome.kill();
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EPERM") {
      throw error;
    }
  }
}

await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      configuration: {
        viewport: "390x844",
        formFactor: "mobile",
        cpuSlowdown: 4,
        runsPerRoute: 3,
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          requestLatencyMs: 150,
          downloadThroughputKbps: 1638.4,
          uploadThroughputKbps: 750,
        },
      },
      routes: values,
    },
    null,
    2,
  )}\n`,
);

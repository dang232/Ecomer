import * as fs from "node:fs";
import * as path from "node:path";

import { test, type Page, type ConsoleMessage } from "@playwright/test";

import { readJsonOr, type ProductListResponse, type SellerSummary } from "./_api";
import { loginAsPersona, registerAndLoginViaOidc } from "./_auth";

/**
 * UX screenshot sweep — visits every reachable page in the FE and writes a
 * full-page PNG plus a per-page console log to test-results/ux-sweep/. The
 * goal is humans-can-read coverage of every screen we ship without driving
 * each flow by hand. Each scenario is its own test() so a single page
 * crashing the React tree doesn't blank-screen everything that comes after.
 *
 * Output layout (relative to fe/):
 *   test-results/ux-sweep/
 *     ├── 01-home.png
 *     ├── 01-home.console.json
 *     ├── 02-search.png
 *     └── …
 *
 * Captures three buckets:
 *   - Public  — anyone can hit (home, search, product, cart, login, etc.)
 *   - Buyer   — gated routes that need a JWT (orders, profile tabs, wishlist,
 *               every checkout step). Logs in as the freshly-registered
 *               buyer so the buyer profile row exists.
 *   - Seller  — /seller/* sub-pages. Uses the seeded `seller1`/`test` user.
 *   - Admin   — /admin/* sub-pages. Uses the seeded admin user if available;
 *               skipped with reason when no admin is seeded.
 *
 * Console errors are non-fatal — they're written to JSON next to the PNG so
 * the post-run triage step can grep for noisy pages. The screenshot itself
 * is the strongest signal: if a page crashes its error boundary, the PNG
 * will show the boundary copy.
 */

const SHEET_DIR = path.resolve(process.cwd(), "test-results", "ux-sweep");
fs.mkdirSync(SHEET_DIR, { recursive: true });

const PASSWORD = "Test1234!";
const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

interface Captured {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
}

interface SellerSweepResponse {
  data?: { content?: SellerSummary[] } | SellerSummary[];
  content?: SellerSummary[];
}

function attachCapture(page: Page): Captured {
  const captured: Captured = { consoleErrors: [], consoleWarnings: [], pageErrors: [] };
  const onConsole = (msg: ConsoleMessage) => {
    const t = msg.type();
    const text = msg.text();
    if (t === "error") captured.consoleErrors.push(text);
    else if (t === "warning") captured.consoleWarnings.push(text);
  };
  page.on("console", onConsole);
  page.on("pageerror", (err) => captured.pageErrors.push(err.message));
  return captured;
}

async function snap(page: Page, captured: Captured, slug: string) {
  // Let lazy chunks settle. networkidle would race with long-poll fetches
  // (notifications) so we cap at 1.5s.
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
    await page.waitForLoadState("networkidle", { timeout: 1_500 }).catch(() => undefined);
  } catch {
    // proceed — even a partial render is worth capturing
  }
  const pngPath = path.join(SHEET_DIR, `${slug}.png`);
  await page.screenshot({ path: pngPath, fullPage: true });
  fs.writeFileSync(path.join(SHEET_DIR, `${slug}.console.json`), JSON.stringify(captured, null, 2));
}

async function login(page: Page, persona: "buyer" | "seller" | "admin") {
  await loginAsPersona(page, persona);
}

async function registerFreshBuyer(page: Page): Promise<string> {
  const stamp = Date.now();
  const email = `e2e_sweep_${stamp}@vnshop.local`;
  await registerAndLoginViaOidc(page, {
    firstName: "Sweep",
    lastName: "Tester",
    email,
    password: PASSWORD,
  });
  return email;
}

test.describe("UX sweep — public pages", () => {
  test("01 home", async ({ page }) => {
    const c = attachCapture(page);
    await page.goto("/");
    await snap(page, c, "01-home");
  });

  test("02 search empty", async ({ page }) => {
    const c = attachCapture(page);
    await page.goto("/search");
    await snap(page, c, "02-search-empty");
  });

  test("03 search query", async ({ page, request }) => {
    const c = attachCapture(page);
    const apiRes = await request.get(`${apiURL}/products?size=1`);
    const body = await readJsonOr<ProductListResponse>(apiRes, {});
    const term = (body.data?.content?.[0]?.name ?? "Sony").split(" ")[0];
    await page.goto(`/search?q=${encodeURIComponent(term)}`);
    await snap(page, c, "03-search-query");
  });

  test("04 product detail", async ({ page, request }) => {
    const c = attachCapture(page);
    const apiRes = await request.get(`${apiURL}/products?size=1`);
    const body = await readJsonOr<ProductListResponse>(apiRes, {});
    const id = body.data?.content?.[0]?.id;
    if (!id) {
      throw new Error("No products seeded — cannot capture product detail snap");
    }
    await page.goto(`/product/${id}`);
    await snap(page, c, "04-product-detail");
  });

  test("05 cart guest", async ({ page }) => {
    const c = attachCapture(page);
    await page.goto("/cart");
    await snap(page, c, "05-cart-guest");
  });

  test("06 login", async ({ page }) => {
    const c = attachCapture(page);
    await page.goto("/login");
    await snap(page, c, "06-login");
  });

  test("07 register", async ({ page }) => {
    const c = attachCapture(page);
    await page.goto("/register");
    await snap(page, c, "07-register");
  });

  test("08 password reset", async ({ page }) => {
    const c = attachCapture(page);
    await page.goto("/password-reset");
    await snap(page, c, "08-password-reset");
  });

  test("09 design system", async ({ page }) => {
    const c = attachCapture(page);
    await page.goto("/design-system");
    await snap(page, c, "09-design-system");
  });

  test("10 seller detail", async ({ page, request }) => {
    const c = attachCapture(page);
    const apiRes = await request.get(`${apiURL}/sellers?size=1`).catch(() => null);
    const body: SellerSweepResponse = apiRes?.ok()
      ? await readJsonOr<SellerSweepResponse>(apiRes, {})
      : {};
    const id = Array.isArray(body.data)
      ? body.data[0]?.id
      : (body.data?.content?.[0]?.id ?? body.content?.[0]?.id);
    if (!id) {
      await page.goto("/sellers/00000000-0000-0000-0000-000000000000");
      await snap(page, c, "10-seller-detail-missing");
      return;
    }
    await page.goto(`/sellers/${id}`);
    await snap(page, c, "10-seller-detail");
  });

  test("11 payment return placeholder", async ({ page }) => {
    const c = attachCapture(page);
    await page.goto("/payment/return/vnpay");
    await snap(page, c, "11-payment-return");
  });
});

test.describe("UX sweep — authenticated buyer", () => {
  test("20 buyer flow + every protected page", async ({ page }) => {
    const c = attachCapture(page);
    await registerFreshBuyer(page);
    await snap(page, c, "20-home-loggedin");

    await page.goto("/orders");
    await snap(page, c, "21-orders");

    await page.goto("/wishlist");
    await snap(page, c, "22-wishlist");

    await page.goto("/messages");
    await snap(page, c, "23-messages");

    await page.goto("/profile");
    await snap(page, c, "24-profile-info");

    await page.getByRole("tab", { name: /^addresses$|^địa chỉ$/i }).click();
    await snap(page, c, "25-profile-addresses");

    await page.getByRole("tab", { name: /payment methods|phương thức thanh toán/i }).click();
    await snap(page, c, "26-profile-payment");

    await page.getByRole("tab", { name: /security|bảo mật/i }).click();
    await snap(page, c, "27-profile-security");
  });

  test("30 checkout — empty cart fallback", async ({ page }) => {
    const c = attachCapture(page);
    await registerFreshBuyer(page);
    await page.goto("/checkout");
    await snap(page, c, "30-checkout-empty");
  });

  test("31 checkout — happy path each step", async ({ page, request }) => {
    const c = attachCapture(page);
    await registerFreshBuyer(page);

    // Add a product to cart so checkout has something to render.
    const apiRes = await request.get(`${apiURL}/products?size=1`);
    const body = await readJsonOr<ProductListResponse>(apiRes, {});
    const productId = body.data?.content?.[0]?.id;
    if (!productId) {
      await page.goto("/checkout");
      await snap(page, c, "31-checkout-no-products");
      return;
    }
    await page.goto(`/product/${productId}`);
    const addBtn = page.getByRole("button", { name: /add to cart|thêm vào giỏ/i }).first();
    await addBtn.click().catch(() => undefined);

    await page.goto("/checkout");
    await snap(page, c, "31-checkout-step-address");
    // The remaining steps depend on a valid address + shipping selection
    // which is more orchestration than a screenshot pass — record the
    // address step for now and let the explicit flow tests pick up the
    // payment/review steps.
  });
});

test.describe("UX sweep — seller", () => {
  test("40 seller dashboard + sub-pages", async ({ page }) => {
    const c = attachCapture(page);
    await login(page, "seller");
    await page.goto("/seller");
    await snap(page, c, "40-seller-dashboard");

    for (const sub of [
      ["products", "41-seller-products"],
      ["orders", "42-seller-orders"],
      ["reviews", "43-seller-reviews"],
      ["wallet", "44-seller-wallet"],
      ["settings", "45-seller-settings"],
    ] as const) {
      await page.goto(`/seller/${sub[0]}`);
      await snap(page, c, sub[1]);
    }
  });
});

test.describe("UX sweep — admin", () => {
  test("50 admin dashboard + sub-pages (requires seeded admin user)", async ({ page }) => {
    const c = attachCapture(page);
    // Verify admin login. If the realm hasn't been seeded the test fails
    // explicitly rather than silently skipping.
    await loginAsPersona(page, "admin");
    await page.waitForTimeout(2_000);
    if (new URL(page.url()).pathname !== "/") {
      throw new Error("Admin login failed — no seeded admin user in this environment");
    }
    await page.goto("/admin");
    await snap(page, c, "50-admin-dashboard");
    for (const sub of [
      ["sellers", "51-admin-sellers"],
      ["coupons", "52-admin-coupons"],
      ["payouts", "53-admin-payouts"],
      ["disputes", "54-admin-disputes"],
      ["reviews", "55-admin-reviews"],
    ] as const) {
      await page.goto(`/admin/${sub[0]}`);
      await snap(page, c, sub[1]);
    }
  });
});

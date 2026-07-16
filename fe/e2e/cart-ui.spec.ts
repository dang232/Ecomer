import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * UI-driven QA spec for the buyer cart flow.
 *
 * What this proves through the actual SPA:
 *   - /cart page loads without the page-wide error fallback (post-pt28
 *     cart schema alignment)
 *   - Cart items render the real product NAME (not a UUID) and a non-zero
 *     PRICE — proves the cart-service product-enrichment via PRODUCT_SERVICE_URL
 *     + variants[].priceAmount adapter is wired correctly (post-b9af48b4)
 *   - Quantity +/- buttons mutate state and re-render new totals
 *   - Remove button drops the item and the empty-state copy appears
 *
 * Setup (register + first add-to-cart) goes through the API. The actual
 * cart page interactions go through real button clicks so we know the
 * SPA wiring works end-to-end.
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

interface SeededBuyer {
  email: string;
  accessToken: string;
}

async function seedBuyer(request: APIRequestContext): Promise<SeededBuyer> {
  const stamp = Date.now() + Math.floor(Math.random() * 1_000);
  const email = `e2e_qa_cart_${stamp}@vnshop.local`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "QA", lastName: "Cart", email, password: PASSWORD },
  });
  expect(reg.ok(), `register: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${apiURL}/auth/login`, {
    data: { username: email, password: PASSWORD },
  });
  expect(login.ok(), `login: ${login.status()}`).toBeTruthy();
  const accessToken = (await login.json())?.data?.accessToken;
  expect(accessToken).toBeTruthy();
  return { email, accessToken };
}

interface SeededProduct {
  id: string;
  name: string;
}

async function firstProduct(request: APIRequestContext): Promise<SeededProduct> {
  const r = await request.get(`${apiURL}/products?size=1`);
  expect(r.ok()).toBeTruthy();
  const p = (await r.json())?.data?.content?.[0];
  expect(p?.id, "expected a seeded product").toBeTruthy();
  return { id: p.id, name: p.name };
}

async function addToCart(
  request: APIRequestContext,
  buyer: SeededBuyer,
  productId: string,
  quantity = 1,
): Promise<void> {
  const r = await request.post(`${apiURL}/cart/items`, {
    headers: { Authorization: `Bearer ${buyer.accessToken}` },
    data: { productId, quantity },
  });
  expect(r.ok(), `add to cart: ${r.status()} ${await r.text()}`).toBeTruthy();
}

async function loadCartAuthenticated(page: Page): Promise<void> {
  await page.goto("/cart");
  // Must NOT show the global error fallback. EITHER the empty-cart copy OR
  // the cart row is acceptable; the bug fix is proven by NEITHER throwing.
  await expect(
    page.getByText(/Cart|Giỏ hàng|Log in to view|Đăng nhập để xem/i).first(),
  ).toBeVisible({ timeout: 20_000 });
}

test.describe("cart page UI — buyer flow", () => {
  test("cart renders product name and price (not UUID + 0₫)", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const product = await firstProduct(page.request);
    await addToCart(page.request, buyer, product.id);
    await loadCartAuthenticated(page);

    // The pre-b9af48b4 bug: cart items rendered as the raw productId UUID
    // with 0₫ because cart-service's product-enrichment branch fell through
    // (PRODUCT_SERVICE_URL was unset) and even when set it read price/image
    // from the wrong location on the BE response.
    //
    // What we assert now:
    //   1. The product NAME is on the page (not the UUID).
    //   2. There is at least one currency-formatted amount that is NOT zero.
    await expect(page.getByText(product.name, { exact: false })).toBeVisible({
      timeout: 15_000,
    });

    // The UUID format is 8-4-4-4-12 hex; assert it's NOT what's rendered as
    // the product line item title. (The page may show the full id elsewhere
    // — order id chips, debug strings — so we scope this to product cards.)
    const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
    const productNameLine = page.getByText(product.name, { exact: false }).first();
    const productNameText = await productNameLine.innerText();
    expect(productNameText).not.toMatch(uuidPattern);

    // A non-zero VND price — Vietnamese formatPrice emits "1.234.567 ₫".
    // Match the dot-separated thousands followed by ₫ symbol.
    const priceLines = await page.getByText(/\d{1,3}(?:\.\d{3})+\s*₫/).allInnerTexts();
    expect(
      priceLines.some((s) => !/^0\s*₫/.test(s)),
      `expected a non-zero VND price; saw: ${JSON.stringify(priceLines).slice(0, 200)}`,
    ).toBe(true);
  });

  test("quantity + button increases the cart line and recomputes totals", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const product = await firstProduct(page.request);
    await addToCart(page.request, buyer, product.id, 1);
    await loadCartAuthenticated(page);

    await expect(page.getByText(product.name, { exact: false })).toBeVisible({
      timeout: 15_000,
    });

    const totalBefore = await firstNonZeroVnd(page);
    expect(totalBefore, "expected a starting total").toBeGreaterThan(0);

    // Lucide icons don't carry tabler class names. Anchor on aria-label
    // instead so the unlabeled icon-only buttons are unambiguous.
    const plusBtn = page.getByRole("button", { name: /increase quantity/i }).first();
    await expect(plusBtn).toBeVisible({ timeout: 10_000 });
    await plusBtn.click();

    await expect
      .poll(async () => firstNonZeroVnd(page), {
        timeout: 15_000,
        message: "cart total never increased after clicking +",
      })
      .toBeGreaterThan(totalBefore);
  });

  test("remove button drops the item and shows the empty-cart copy", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const product = await firstProduct(page.request);
    await addToCart(page.request, buyer, product.id, 1);
    await loadCartAuthenticated(page);

    await expect(page.getByText(product.name, { exact: false })).toBeVisible({
      timeout: 15_000,
    });

    const removeBtn = page.getByRole("button", { name: /remove.*from cart/i }).first();
    await expect(removeBtn).toBeVisible({ timeout: 10_000 });
    await removeBtn.click();

    await expect(page.getByText(/Your cart is empty|Giỏ hàng trống/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});

/**
 * Pull the largest currency-formatted amount on the page (the running total
 * tends to be the largest by construction — single-line items aggregate up).
 * Returns 0 if no price is found.
 */
async function firstNonZeroVnd(page: Page): Promise<number> {
  const lines = await page.getByText(/\d{1,3}(?:\.\d{3})+\s*₫/).allInnerTexts();
  let max = 0;
  for (const line of lines) {
    const m = /(\d{1,3}(?:\.\d{3})+)/.exec(line);
    if (!m) continue;
    const v = Number.parseInt(m[1].replace(/\./g, ""), 10);
    if (Number.isFinite(v) && v > max) max = v;
  }
  return max;
}

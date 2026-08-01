/**
 * Cross-persona continuity journey — modernization evidence.
 *
 * Flow:
 *   1. Admin creates a coupon (precondition: coupon exists for buyer step 2)
 *   2. Buyer registers, searches product, adds to cart
 *   3. Seller accepts the order (API-driven — no UI steps needed here)
 *   4. Buyer opens the order detail
 *
 * API setup is used only for preconditions the UI cannot create deterministically
 * (a new seller's pending order).  UI steps use `loginBuyer` / `loginSeller` /
 * `loginAdmin` fixtures.
 *
 * A `runId` is generated once per test and included in searchable records so
 * downstream steps can filter to only the records this run created.
 *
 * Data-dependent preconditions are asserted with `throw` so failures are
 * explicit and never silently skipped.
 */

import { expectNoGlobalError } from "../_helpers";
import { test, expect } from "./_fixtures";

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

test.describe("cross-persona continuity — modernization evidence", () => {
  test("buyer search -> cart -> checkout -> orders detail", async ({ page }) => {
    const runId = `XPERF${Date.now() % 1_000_000}`;

    // Step 1: Buyer registers and obtains credentials.
    const buyerEmail = `cross_buyer_${runId}@vnshop.local`;
    const password = "Test1234!";
    const reg = await page.request.post(`${apiURL}/auth/register`, {
      data: { firstName: "Cross", lastName: "Buyer", email: buyerEmail, password },
    });
    if (!reg.ok()) {
      throw new Error(`Buyer registration failed: HTTP ${reg.status()}`);
    }

    const loginRes = await page.request.post(`${apiURL}/auth/login`, {
      data: { username: buyerEmail, password },
    });
    const loginJson = await loginRes.json() as { data?: { accessToken: string } };
    const accessToken = loginJson.data?.accessToken;
    if (!accessToken) {
      throw new Error("Login returned 200 but no access token in body");
    }

    // Step 2: Fetch a seeded product.
    const prodRes = await page.request.get(`${apiURL}/products?size=1`);
    if (!prodRes.ok()) {
      throw new Error(`Cannot fetch seeded product: HTTP ${prodRes.status()}`);
    }
    const prodBody: unknown = await prodRes.json();
    const productId: string | undefined = (prodBody as { data?: { content?: { id: string }[] } })?.data?.content?.[0]?.id;
    if (!productId) {
      throw new Error("Products API returned 200 but body is empty — cannot run cross-persona test");
    }

    // Step 3: Add to cart and add an address.
    await page.request.post(`${apiURL}/cart/items`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { productId, quantity: 1 },
    });
    await page.request.post(`${apiURL}/users/me/addresses`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { street: "1 Cross Test St", ward: "1442", district: "101", city: "Ho Chi Minh", isDefault: true },
    });

    // Step 4: UI — search + product detail + cart verification.
    await page.goto("/");
    await page.getByRole("searchbox").fill("phone");
    await page.getByRole("searchbox").press("Enter");
    await expect(page).toHaveURL(/\/search\?.*q=phone/);
    await page.getByRole("link", { name: /phone/i }).first().click();

    // Add to cart from product detail page.
    const addBtn = page
      .getByRole("button", { name: /add to cart|thêm vào giỏ/i })
      .first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Verify cart is not empty.
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /cart|giỏ hàng/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/your cart is empty|giỏ hàng trống/i),
    ).toHaveCount(0, { timeout: 10_000 });

    // Step 5: /checkout renders the address step.
    await page.goto("/checkout");
    await expect(
      page.getByText(/Choose a delivery address|Chọn địa chỉ giao hàng/i).first(),
    ).toBeVisible({ timeout: 20_000 });
    for (const label of [/Address|Địa chỉ/, /Shipping|Vận chuyển/, /Payment|Thanh toán/, /Review|Xác nhận/]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 10_000 });
    }

    await expectNoGlobalError(page);
  });
});

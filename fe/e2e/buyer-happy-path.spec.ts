import { test, expect } from "@playwright/test";

import { registerAndLoginViaOidc } from "./_auth";
import { readJson, type ProductListResponse } from "./_api";

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

test.describe("buyer happy path", () => {
  test("register -> product detail -> add to cart -> /cart shows item", async ({
    page,
    request,
  }) => {
    const email = `e2e_buyer_${Date.now()}@vnshop.local`;
    await registerAndLoginViaOidc(page, {
      firstName: "E2E",
      lastName: "Buyer",
      email,
      password: PASSWORD,
    });
    const apiRes = await request.get(`${apiURL}/products?size=1`);
    expect(apiRes.ok()).toBeTruthy();
    const productId = (await readJson<ProductListResponse>(apiRes)).data?.content?.[0]?.id;
    expect(productId, "expected at least one product seeded").toBeTruthy();
    if (!productId) throw new Error("expected at least one product seeded");
    await page.goto(`/product/${productId}`);
    const addBtn = page
      .getByRole("button", { name: /add to cart|th\u00eam v\u00e0o gi\u1ecf/i })
      .first();
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();
    await page.goto("/cart");
    await expect(page.getByText(/your cart is empty|gi\u1ecf h\u00e0ng tr\u1ed1ng/i)).toHaveCount(
      0,
      {
        timeout: 15_000,
      },
    );
  });

  test("login form rejects invalid credentials with an inline error", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#username").fill("does-not-exist@vnshop.local");
    await page.locator("#password").fill("definitely-not-the-password");
    await page
      .getByRole("button", { name: /sign in|continue to sign in|\u0111\u0103ng nh\u1eadp/i })
      .click();
    await expect(page.getByText(/Invalid (username or password|user credentials)/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });
});

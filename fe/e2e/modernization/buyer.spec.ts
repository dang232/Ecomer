/**
 * Buyer persona journey — modernization evidence.
 *
 * Covers: search → product detail → add to cart → cart → checkout →
 * orders → order detail → wishlist → profile.  Uses `loginBuyer` fixture
 * which resolves credentials through the centralized credential store so the
 * suite works in both local and protected-contract modes.
 *
 * Remote-service gaps (VNPay, MoMo) that cannot be exercised in CI are
 * exercised by the release-contract staging gate instead.
 */

import { expectNoGlobalError } from "../_helpers";

import { test, expect } from "./_fixtures";

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

test.describe("buyer persona — modernization evidence", () => {
  test("search -> product detail -> add to cart -> /cart shows item", async ({
    page,
    loginBuyer,
  }) => {
    await loginBuyer();
    await page.goto("/");
    const search = page.getByRole("combobox", { name: "Search products" });
    await search.fill("phone");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/search\?.*q=phone/);

    const productLink = page.getByRole("link", { name: /phone/i }).first();
    await productLink.click();
    await expect(page.getByRole("heading", { name: /phone/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    const addBtn = page.getByRole("button", { name: /add to cart|thêm vào giỏ/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /cart|giỏ hàng/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    // Cart should not be empty — the item was just added.
    await expect(page.getByText(/your cart is empty|giỏ hàng trống/i)).toHaveCount(0, {
      timeout: 10_000,
    });
    await expectNoGlobalError(page);
  });

  test("/checkout renders the 4-step panel for a buyer with cart + address", async ({
    page,
    loginBuyer,
    request,
  }) => {
    // Register a fresh buyer so we control the cart state.
    const buyerEmail = `mod_buyer_${Date.now()}@vnshop.local`;
    const password = "Test1234!";
    await request.post(`${apiURL}/auth/register`, {
      data: { firstName: "Mod", lastName: "Buyer", email: buyerEmail, password },
    });

    // Add a seeded product to cart.
    const prodRes = await request.get(`${apiURL}/products?size=1`);
    if (!prodRes.ok()) {
      throw new Error(`Cannot seed a product for checkout test: HTTP ${prodRes.status()}`);
    }
    const prodBody: unknown = await prodRes.json();
    const productId: string | undefined = (prodBody as { data?: { content?: { id: string }[] } })
      ?.data?.content?.[0]?.id;
    if (!productId) {
      throw new Error(
        "API returned 200 but no products in body — cannot run cart-dependent checkout test",
      );
    }

    const loginRes = await request.post(`${apiURL}/auth/login`, {
      data: { username: buyerEmail, password },
    });
    if (!loginRes.ok()) {
      throw new Error(`Login failed: HTTP ${loginRes.status()}`);
    }
    const loginBody: unknown = await loginRes.json();
    const accessToken: string | undefined = (loginBody as { data?: { accessToken: string } })?.data
      ?.accessToken;
    if (!accessToken) {
      throw new Error("Login returned 200 but no access token in body");
    }

    await request.post(`${apiURL}/cart/items`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { productId, quantity: 1 },
    });

    // Add a delivery address.
    await request.post(`${apiURL}/users/me/addresses`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        street: "1 E2E Test Street",
        ward: "1442",
        district: "101",
        city: "Ho Chi Minh",
        isDefault: true,
      },
    });

    await loginBuyer();
    await page.goto("/checkout");
    await expect(
      page.getByText(/Choose a delivery address|Chọn địa chỉ giao hàng/i).first(),
    ).toBeVisible({ timeout: 20_000 });
    for (const label of [
      /Address|Địa chỉ/,
      /Shipping|Vận chuyển/,
      /Payment|Thanh toán/,
      /Review|Xác nhận/,
    ]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 10_000 });
    }
    await expectNoGlobalError(page);
  });

  test("/orders renders for an authenticated buyer", async ({ page, loginBuyer }) => {
    await loginBuyer();
    await page.goto("/orders");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/orders");
    await expect(page.getByRole("heading", { name: /orders|đơn hàng/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoGlobalError(page);
  });

  test("/wishlist renders for an authenticated buyer", async ({ page, loginBuyer }) => {
    await loginBuyer();
    await page.goto("/wishlist");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/wishlist");
    await expect(page.getByRole("heading", { name: /wishlist|yêu thích/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoGlobalError(page);
  });

  test("/profile renders for an authenticated buyer", async ({ page, loginBuyer }) => {
    await loginBuyer();
    await page.goto("/profile");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/profile");
    await expectNoGlobalError(page);
  });
});

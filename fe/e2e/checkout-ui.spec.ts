import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { expectNoGlobalError } from "./_helpers";
import { loginViaOidc } from "./_auth";

/**
 * UI-driven QA spec for the checkout flow.
 *
 * What this proves through the actual SPA:
 *   - /checkout renders without the global error fallback
 *   - Empty-cart state shows the "Continue shopping" CTA
 *   - With a cart item, the address step is the entry point
 *   - With NO addresses on the buyer profile, the page surfaces the
 *     "go to profile" prompt (instead of crashing)
 *   - With an address, the steps panel renders Address/Shipping/Payment/Review
 *
 * Locks in the pt28 calculateCheckoutSchema fix (BE returns
 * itemsTotal/shippingEstimate/finalAmount; FE expected
 * subtotal/shippingFee/total — schema now aliases via transform).
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

interface SeededBuyer {
  email: string;
  accessToken: string;
}

async function seedBuyer(request: APIRequestContext): Promise<SeededBuyer> {
  const stamp = Date.now() + Math.floor(Math.random() * 1_000);
  const email = `e2e_qa_checkout_${stamp}@vnshop.local`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "QA", lastName: "Checkout", email, password: PASSWORD },
  });
  expect(reg.ok(), `register: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${apiURL}/auth/login`, {
    data: { username: email, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await login.json())?.data?.accessToken;
  expect(accessToken).toBeTruthy();
  return { email, accessToken };
}

async function firstProductId(request: APIRequestContext): Promise<string> {
  const r = await request.get(`${apiURL}/products?size=1`);
  expect(r.ok()).toBeTruthy();
  const id = (await r.json())?.data?.content?.[0]?.id;
  expect(id, "expected a seeded product").toBeTruthy();
  return id;
}

async function addToCart(
  request: APIRequestContext,
  buyer: SeededBuyer,
  productId: string,
): Promise<void> {
  const r = await request.post(`${apiURL}/cart/items`, {
    headers: { Authorization: `Bearer ${buyer.accessToken}` },
    data: { productId, quantity: 1 },
  });
  expect(r.ok(), `cart add: ${r.status()}`).toBeTruthy();
}

async function addAddress(request: APIRequestContext, buyer: SeededBuyer): Promise<void> {
  const r = await request.post(`${apiURL}/users/me/addresses`, {
    headers: { Authorization: `Bearer ${buyer.accessToken}` },
    data: {
      street: "1 QA Test Street",
      ward: "1442",
      district: "101",
      city: "Ho Chi Minh",
      isDefault: true,
    },
  });
  expect(r.ok()).toBeTruthy();
}

test.describe("checkout flow UI", () => {
  test("Empty cart on /checkout shows the empty-state CTA", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    await loginViaOidc(page, buyer.email, PASSWORD);
    await page.goto("/checkout");

    await expect(page.getByText(/Your cart is empty|Giỏ hàng trống/i)).toBeVisible({
      timeout: 20_000,
    });
    await expectNoGlobalError(page);
  });

  test("Buyer with cart but no address sees the 'go to profile' prompt", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const productId = await firstProductId(page.request);
    await addToCart(page.request, buyer, productId);
    await loginViaOidc(page, buyer.email, PASSWORD);

    await page.goto("/checkout");

    // Address step renders with the empty-state copy.
    await expect(
      page
        .getByText(
          /You don't have any addresses yet|Bạn chưa có địa chỉ nào|Please add at least one address|add a delivery address/i,
        )
        .first(),
    ).toBeVisible({ timeout: 20_000 });
    await expectNoGlobalError(page);
  });

  test("Buyer with cart + address sees the 4-step checkout panel", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const productId = await firstProductId(page.request);
    await addToCart(page.request, buyer, productId);
    await addAddress(page.request, buyer);
    await loginViaOidc(page, buyer.email, PASSWORD);

    await page.goto("/checkout");

    // Wait for the address step to render (means /checkout/calculate
    // already returned; pre-pt28 it returned itemsTotal/finalAmount which
    // the FE schema rejected and the page errored out).
    await expect(
      page.getByText(/Choose a delivery address|Chọn địa chỉ giao hàng/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // The four step labels are visible in the steps strip.
    for (const label of [
      /Address|Địa chỉ/,
      /Shipping|Vận chuyển/,
      /Payment|Thanh toán/,
      /Review|Xác nhận/,
    ]) {
      await expect(page.getByText(label).first()).toBeVisible({
        timeout: 10_000,
      });
    }

    await expectNoGlobalError(page);
  });
});

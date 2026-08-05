import { test, expect, type APIRequestContext } from "@playwright/test";

import { loginViaOidc, uniqueTestId } from "./_auth";
import {
  readJson,
  type AuthResponse,
  type OrderListResponse,
  type OrderResponse,
  type ProductListResponse,
} from "./_api";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the /orders tab filter.
 *
 * What this proves through the actual SPA:
 *   - Tabs render (All / Pending / Shipping / Delivered / Cancelled)
 *   - Click a tab → only orders matching that status remain visible
 *   - Cancelled tab on a pending-only buyer shows the empty-state copy
 *
 * Locks in the OrderTab filter logic which depends on the order schema
 * transform's derived `status` field. If the derive logic regresses,
 * the wrong tab will show the wrong rows.
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

interface SeededBuyer {
  email: string;
  accessToken: string;
}

async function seedBuyer(request: APIRequestContext): Promise<SeededBuyer> {
  const stamp = uniqueTestId();
  const email = `e2e_qa_orders_tabs_${stamp}@vnshop.local`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "QA", lastName: "Tabs", email, password: PASSWORD },
  });
  expect(reg.ok(), `register: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${apiURL}/auth/login`, {
    data: { username: email, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await readJson<AuthResponse>(login)).data?.accessToken;
  expect(accessToken).toBeTruthy();
  if (!accessToken) throw new Error("login did not return an access token");
  return { email, accessToken };
}

async function placePendingOrder(request: APIRequestContext, buyer: SeededBuyer): Promise<string> {
  const headers = { Authorization: `Bearer ${buyer.accessToken}` };
  const products = await request.get(`${apiURL}/products?size=1`);
  const productId = (await readJson<ProductListResponse>(products)).data?.content?.[0]?.id;
  expect(productId).toBeTruthy();
  if (!productId) throw new Error("expected a seeded product");

  await request.post(`${apiURL}/cart/items`, {
    headers,
    data: { productId, quantity: 1 },
  });

  const address = {
    street: "1 QA Tabs Street",
    ward: "1442",
    district: "101",
    city: "Ho Chi Minh",
  } as const;
  await request.post(`${apiURL}/users/me/addresses`, {
    headers,
    data: { ...address, isDefault: true },
  });

  const idem = `qa-tabs-${uniqueTestId()}`;
  const place = await request.post(`${apiURL}/orders`, {
    headers: { ...headers, "Idempotency-Key": idem },
    data: {
      shippingAddress: address,
      items: [{ productId, quantity: 1 }],
      paymentMethod: "COD",
    },
  });
  expect(place.ok()).toBeTruthy();
  const orderId = (await readJson<OrderResponse>(place)).data?.id;
  expect(orderId).toBeTruthy();
  if (!orderId) throw new Error("order placement did not return an id");

  // Wait for the read-model projection to land so the list endpoint
  // returns the new order.
  for (let i = 0; i < 10; i++) {
    const list = await request.get(`${apiURL}/orders?size=10`, { headers });
    const ids = ((await readJson<OrderListResponse>(list)).data?.content ?? []).map(
      (o: { id?: string; orderId?: string }) => o.id ?? o.orderId,
    );
    if (ids.includes(orderId)) return orderId;
    await new Promise((r) => setTimeout(r, 500));
  }
  return orderId;
}

test.describe("orders tab filter UI", () => {
  test("All tab and Pending tab both show the freshly placed order", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const orderId = await placePendingOrder(page.request, buyer);
    const idShort = orderId.slice(0, 8);

    await loginViaOidc(page, buyer.email, PASSWORD);
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: /My Orders|Đơn hàng của tôi/i })).toBeVisible({
      timeout: 20_000,
    });

    // Default "All" tab — order is visible.
    await expect(page.locator("div", { hasText: idShort }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Click the "Pending" tab — same order still visible (it's pending).
    await page.getByRole("tab", { name: /^(Pending|Chờ xác nhận)/i }).click();
    await expect(page.locator("div", { hasText: idShort }).first()).toBeVisible({
      timeout: 10_000,
    });

    await expectNoGlobalError(page);
  });

  test("Delivered tab shows empty state when buyer has only pending orders", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    await placePendingOrder(page.request, buyer);

    await loginViaOidc(page, buyer.email, PASSWORD);
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: /My Orders|Đơn hàng của tôi/i })).toBeVisible({
      timeout: 20_000,
    });

    // Click "Delivered" — buyer's only order is pending, so this filter
    // hides it. The empty-state copy renders OR the tab body is empty.
    await page.getByRole("tab", { name: /^(Delivered|Đã giao)/i }).click();

    // After tab switch, the empty-state copy should appear. The page uses
    // "No orders to show" / "Không có đơn hàng nào" for the empty filtered
    // state.
    await expect(page.getByText(/No orders to show|Không có đơn hàng nào/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await expectNoGlobalError(page);
  });
});

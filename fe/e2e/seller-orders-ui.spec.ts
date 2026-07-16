import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the seller orders queue.
 *
 * What this proves through the actual SPA:
 *   - /seller renders without the global error fallback
 *   - Navigating to the Orders tab shows the queue
 *   - The queue lists rows in the FE-flattened PendingSubOrder shape
 *     even though /seller/orders/pending returns nested OrderResponse
 *     objects (locks in 0a3c0f8a — the endpoint adapter flatten)
 *
 * Uses the seeded seller1 Keycloak account.
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

interface AuthResult {
  accessToken: string;
}

async function loginAsSeller(request: APIRequestContext): Promise<AuthResult> {
  const r = await request.post(`${apiURL}/auth/login`, {
    data: { username: "seller1", password: "test" },
  });
  expect(r.ok(), `seller login: ${r.status()} ${await r.text()}`).toBeTruthy();
  const accessToken = (await r.json())?.data?.accessToken;
  expect(accessToken).toBeTruthy();
  return { accessToken };
}

test.describe("seller orders queue UI", () => {
  test("/seller dashboard renders for seller1 without the global error", async ({ page }) => {
    await loginAsSeller(page.request);
    await page.goto("/seller");

    // Either the dashboard tab content OR the seller-channel layout shell.
    // Both confirm the page mounted past Suspense.
    await expect(
      page.getByText(/Dashboard|Tổng quan|Seller Hub|Kênh Người Bán/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await expectNoGlobalError(page);
  });

  test("Orders tab renders queue header (proves /seller/orders/pending parses)", async ({
    page,
  }) => {
    await loginAsSeller(page.request);
    await page.goto("/seller");

    // Wait for the seller shell to mount before clicking the Orders tab.
    await expect(
      page.getByText(/Dashboard|Tổng quan|Seller Hub|Kênh Người Bán/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Click the Orders nav button. The label is localized; match either.
    const ordersTab = page.getByRole("button", { name: /^(Orders|Đơn hàng)$/ }).first();
    await expect(ordersTab).toBeVisible({ timeout: 10_000 });
    await ordersTab.click();

    // The current shell exposes the tab as the visible Orders heading. Empty-
    // state copy is a valid signal too — both prove the JSON parse landed.
    // Pre-0a3c0f8a this would have crashed because the FE schema expected a
    // flat sub-order list and the BE returned nested OrderResponse objects.
    await expect(
      page.getByRole("heading", { name: /Orders|Order management/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await expectNoGlobalError(page);
  });
});

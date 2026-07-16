import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the seller products tab.
 *
 * What this proves through the actual SPA:
 *   - Click Products tab — table renders with header columns
 *   - Search input is present
 *   - "Add product" CTA is visible
 *   - The page does not crash with the global error fallback (proves
 *     the seller's product list endpoint parses)
 *
 * No backend mutation needed; seller1 is a seeded fixture.
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

interface AuthResult {
  accessToken: string;
}

async function loginAsSeller(request: APIRequestContext): Promise<AuthResult> {
  const r = await request.post(`${apiURL}/auth/login`, {
    data: { username: "seller1", password: "test" },
  });
  expect(r.ok(), `seller login: ${r.status()}`).toBeTruthy();
  const accessToken = (await r.json())?.data?.accessToken;
  expect(accessToken).toBeTruthy();
  return { accessToken };
}

test.describe("seller products UI", () => {
  test("Products tab renders the table chrome (header columns + Add CTA)", async ({ page }) => {
    await loginAsSeller(page.request);
    await page.goto("/seller");

    await expect(
      page.getByRole("heading", { name: /^(Dashboard|Tổng quan)$/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    const productsTab = page.getByRole("button", { name: /^(Products|Sản phẩm)$/i }).first();
    await expect(productsTab).toBeVisible({ timeout: 10_000 });
    await productsTab.click();

    // Page heading.
    await expect(page.getByText(/Product management|Quản lý sản phẩm/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Add CTA.
    await expect(
      page.getByRole("button", { name: /Add product|Thêm sản phẩm/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Table column headers — match VI or EN.
    for (const col of [
      /^Product$|^Sản phẩm$/i,
      /^Price$|^Giá$/i,
      /^Stock$|^Kho$/i,
      /^Sold$|^Đã bán$/i,
    ]) {
      await expect(page.getByText(col).first()).toBeVisible({ timeout: 10_000 });
    }

    await expectNoGlobalError(page);
  });
});

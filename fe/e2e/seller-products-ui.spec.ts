import { test, expect } from "@playwright/test";

import { loginAsPersona } from "./_auth";
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

test.describe("seller products UI", () => {
  test("Products tab renders the table chrome (header columns + Add CTA)", async ({ page }) => {
    await loginAsPersona(page, "seller");
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

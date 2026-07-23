import { expect, test } from "@playwright/test";

import { loginViaOidc } from "./_auth";
import { expectNoGlobalError } from "./_helpers";

test.describe("dashboard charts", () => {
  test("admin revenue area and top-products column charts render live data", async ({ page }) => {
    await loginViaOidc(page, "admin1");
    await page.goto("/admin");

    await expect(page.getByTestId("admin-revenue-chart")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("admin-top-products-chart")).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByTestId("admin-revenue-chart").locator(".recharts-area-area"),
    ).toHaveCount(1);
    await expect(
      page.getByTestId("admin-top-products-chart").locator(".recharts-bar-rectangle"),
    ).not.toHaveCount(0);
    await expectNoGlobalError(page);
    await page.screenshot({
      path: "e2e/evidence/full-audit/dashboard-charts-admin.png",
      fullPage: true,
    });
  });

  test("seller revenue area and orders column charts render live data", async ({ page }) => {
    await loginViaOidc(page, "seller1");
    await page.goto("/seller");

    await expect(page.getByTestId("seller-revenue-chart")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("seller-orders-chart")).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByTestId("seller-revenue-chart").locator(".recharts-area-area"),
    ).toHaveCount(1);
    await expect(
      page.getByTestId("seller-orders-chart").locator(".recharts-bar-rectangle"),
    ).not.toHaveCount(0);
    await expectNoGlobalError(page);
    await page.screenshot({
      path: "e2e/evidence/full-audit/dashboard-charts-seller.png",
      fullPage: true,
    });
  });
});

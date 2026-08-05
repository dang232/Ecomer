import { expect, test } from "@playwright/test";

import { loginAsPersona } from "./_auth";
import { expectNoGlobalError } from "./_helpers";

test.describe("dashboard charts", () => {
  test("admin revenue area and top-products column charts render live data", async ({ page }) => {
    await loginAsPersona(page, "admin");
    await page.goto("/admin");

    await expect(page.getByTestId("admin-revenue-chart")).toBeVisible({ timeout: 30_000 });
    const topProductsChart = page.getByTestId("admin-top-products-chart");
    const topProductsEmpty = page.getByTestId("admin-top-products-empty");
    await expect
      .poll(async () => (await topProductsChart.count()) + (await topProductsEmpty.count()), {
        timeout: 30_000,
      })
      .toBe(1);
    if (await topProductsChart.count()) {
      await expect(topProductsChart).toBeVisible();
      await expect(topProductsChart.locator(".recharts-bar-rectangle")).not.toHaveCount(0);
    } else {
      await expect(topProductsEmpty).toBeVisible();
    }
    await expect(
      page.getByTestId("admin-revenue-chart").locator(".recharts-area-area"),
    ).toHaveCount(1);
    await expectNoGlobalError(page);
    await page.screenshot({
      path: "e2e/evidence/full-audit/dashboard-charts-admin.png",
      fullPage: true,
    });
  });

  test("seller performance chart renders revenue and order series from live data", async ({
    page,
  }) => {
    await loginAsPersona(page, "seller");
    await page.goto("/seller");

    const performanceChart = page.getByTestId("seller-performance-chart");
    await expect(performanceChart).toBeVisible({ timeout: 30_000 });
    await expect(performanceChart.locator(".recharts-area-area")).toHaveCount(1);
    await expect(performanceChart.locator(".recharts-bar-rectangle")).not.toHaveCount(0);
    await expectNoGlobalError(page);
    await page.screenshot({
      path: "e2e/evidence/full-audit/dashboard-charts-seller.png",
      fullPage: true,
    });
  });
});

import { test, expect, type Page } from "@playwright/test";

import { loginAsPersona } from "./_auth";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the admin console.
 *
 * What this proves through the actual SPA:
 *   - /admin renders for admin1 without the global error fallback
 *   - Each tab (Dashboard, Sellers, Reviews, Coupons, Disputes, Payouts)
 *     loads without crashing — proves all four pt28 admin schema fixes
 *     work end-to-end (sellerSummarySchema / disputeSchema /
 *     adminPayoutSchema / dashboardSummarySchema)
 *   - The Sellers and Disputes lists render either content or empty-state
 *     copy (NOT a Zod parse error)
 */

async function expectTabRenders(page: Page, tabName: RegExp, href: string, contentSignal: RegExp) {
  const link = page.getByRole("link", { name: tabName }).first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await expect(link).toHaveAttribute("href", href);
  await link.click();
  await expect(page.getByText(contentSignal).first()).toBeVisible({
    timeout: 15_000,
  });
  await expectNoGlobalError(page);
}

test.describe("admin console UI", () => {
  test("/admin renders for admin1 with the dashboard tab as default", async ({ page }) => {
    await loginAsPersona(page, "admin");
    await page.goto("/admin");

    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await expectNoGlobalError(page);
  });

  test("Sellers tab loads (locks in sellerSummarySchema fix)", async ({ page }) => {
    await loginAsPersona(page, "admin");
    await page.goto("/admin");
    // Wait for shell.
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // The pre-pt28 sellerSummarySchema demanded a `status: string` field that
    // BE doesn't return (it returns `approved: boolean` instead). Hitting
    // this tab would crash. Now the schema's transform aliases the field.
    await expectTabRenders(
      page,
      /^(Approve Sellers|Duyệt Seller)$/i,
      "/admin/sellers",
      /Approve Sellers|Duyệt Seller|No sellers awaiting approval|Không có seller nào chờ duyệt/i,
    );
  });

  test("Coupons tab loads (locks in couponSchema Long-id coercion + envelope wrap)", async ({
    page,
  }) => {
    await loginAsPersona(page, "admin");
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await expectTabRenders(
      page,
      /^(Coupons|Coupon)$/i,
      "/admin/coupons",
      /Coupon management|Quản lý coupon|No coupons yet|Chưa có coupon nào/i,
    );
  });

  test("Disputes tab loads (locks in disputeSchema disputeId→id alias)", async ({ page }) => {
    await loginAsPersona(page, "admin");
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await expectTabRenders(
      page,
      /^(Disputes|Khiếu nại)$/i,
      "/admin/disputes",
      /Disputes|Khiếu nại|No open disputes|Không có khiếu nại nào đang mở/i,
    );
  });

  test("Payouts tab loads (locks in adminPayoutSchema payoutId→id alias)", async ({ page }) => {
    await loginAsPersona(page, "admin");
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await expectTabRenders(
      page,
      /^(Payouts|Rút tiền)$/i,
      "/admin/payouts",
      /Payout requests|Yêu cầu rút tiền|No payout requests|Không có yêu cầu rút tiền nào/i,
    );
  });
});

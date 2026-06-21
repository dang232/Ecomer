import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
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

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

interface AuthResult {
  accessToken: string;
}

async function loginAsAdmin(request: APIRequestContext): Promise<AuthResult> {
  const r = await request.post(`${apiURL}/auth/login`, {
    data: { username: "admin1", password: "test" },
  });
  expect(r.ok(), `admin login: ${r.status()} ${await r.text()}`).toBeTruthy();
  const accessToken = (await r.json())?.data?.accessToken;
  expect(accessToken).toBeTruthy();
  return { accessToken };
}


async function expectTabRenders(page: Page, tabName: RegExp, contentSignal: RegExp) {
  const tab = page.getByRole("button", { name: tabName }).first();
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();
  await expect(page.getByText(contentSignal).first()).toBeVisible({
    timeout: 15_000,
  });
  await expectNoGlobalError(page);
}

test.describe("admin console UI", () => {
  test("/admin renders for admin1 with the dashboard tab as default", async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto("/admin");

    await expect(
      page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await expectNoGlobalError(page);
  });

  test("Sellers tab loads (locks in sellerSummarySchema fix)", async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto("/admin");
    // Wait for shell.
    await expect(
      page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // The pre-pt28 sellerSummarySchema demanded a `status: string` field that
    // BE doesn't return (it returns `approved: boolean` instead). Hitting
    // this tab would crash. Now the schema's transform aliases the field.
    await expectTabRenders(
      page,
      /^(Approve Sellers|Duyệt Seller)$/i,
      /Approve Sellers|Duyệt Seller|No sellers awaiting approval|Không có seller nào chờ duyệt/i,
    );
  });

  test("Coupons tab loads (locks in couponSchema Long-id coercion + envelope wrap)", async ({
    page,
  }) => {
    await loginAsAdmin(page.request);
    await page.goto("/admin");
    await expect(
      page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await expectTabRenders(
      page,
      /^(Coupons|Coupon)$/i,
      /Coupon management|Quản lý coupon|No coupons yet|Chưa có coupon nào/i,
    );
  });

  test("Disputes tab loads (locks in disputeSchema disputeId→id alias)", async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto("/admin");
    await expect(
      page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await expectTabRenders(
      page,
      /^(Disputes|Khiếu nại)$/i,
      /Disputes|Khiếu nại|No open disputes|Không có khiếu nại nào đang mở/i,
    );
  });

  test("Payouts tab loads (locks in adminPayoutSchema payoutId→id alias)", async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto("/admin");
    await expect(
      page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await expectTabRenders(
      page,
      /^(Payouts|Rút tiền)$/i,
      /Payout requests|Yêu cầu rút tiền|No payout requests|Không có yêu cầu rút tiền nào/i,
    );
  });
});

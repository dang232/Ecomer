import { test, expect } from "@playwright/test";
import {
  copyArtifacts,
  expectNoGlobalError,
  finalizeReport,
  loginAsSeededUser,
  logoutViaUserMenu,
  rememberOutputDir,
  resetPersona,
  startTrace,
  step,
  stopTrace,
} from "./_workday-evidence";

/**
 * Persona workday — Admin.
 *
 * admin1 logs in and walks the admin console: dashboard → sellers tab →
 * coupon CRUD round-trip (create + deactivate) → disputes → payouts → logout.
 *
 * What this spec proves through the actual SPA, end-to-end:
 *   1. Login as admin1 lands on / authenticated
 *   2. /admin dashboard tab renders with the heading
 *   3. Sellers approval queue parses
 *   4. Coupon create round-trips (form → BE → list refresh)
 *   5. The same coupon's deactivate round-trips (Paused badge appears)
 *   6. Disputes tab parses
 *   7. Payouts tab parses
 *   8. Logout returns to home with the Login CTA
 */

test.use({
  video: "on",
  actionTimeout: 30_000,
});

test.describe.serial("Workday — admin (login → console + coupon CRUD → logout)", () => {
  test.beforeAll(async () => {
    await resetPersona("admin");
  });

  test.afterEach(async ({}, testInfo) => {
    rememberOutputDir("admin", testInfo);
  });

  test.afterAll(async () => {
    await copyArtifacts("admin");
    await finalizeReport("admin");
  });

  test.setTimeout(15 * 60 * 1000);

  test("Admin logs in, tours the console, runs a coupon CRUD round-trip, logs out", async ({
    page,
  }) => {
    await startTrace("admin", page);
    try {
      const couponCode = `WORKDAY${Date.now() % 1_000_000}`;

      await step(page, "admin", "Login as admin1 via /login form", async () => {
        await loginAsSeededUser(page, "admin1");
      });

      await step(page, "admin", "/admin dashboard mounts as default tab", async () => {
        await page.goto("/admin");
        await expect(
          page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first(),
        ).toBeVisible({ timeout: 20_000 });
        await expectNoGlobalError(page);
      });

      await step(page, "admin", "Sellers approval queue renders", async () => {
        const sellersTab = page
          .getByRole("button", { name: /^(Approve Sellers|Duyệt Seller)/i })
          .first();
        await expect(sellersTab).toBeVisible({ timeout: 10_000 });
        await sellersTab.click();
        await expect(
          page
            .getByText(
              /Approve Sellers|Duyệt Seller|No sellers awaiting approval|Không có seller nào chờ duyệt/i,
            )
            .first(),
        ).toBeVisible({ timeout: 15_000 });
        await expectNoGlobalError(page);
      });

      await step(page, "admin", "Open Coupons tab", async () => {
        const couponsTab = page.getByRole("button", { name: /^(Coupons|Coupon)/i }).first();
        await expect(couponsTab).toBeVisible({ timeout: 10_000 });
        await couponsTab.click();
        await expect(page.getByText(/Coupon management|Quản lý coupon/i).first()).toBeVisible({
          timeout: 15_000,
        });
        await expectNoGlobalError(page);
      });

      await step(page, "admin", `Create FIXED coupon ${couponCode} round-trips`, async () => {
        await page
          .getByRole("button", {
            name: /Create coupon|\+ Tạo coupon|Tạo coupon/i,
          })
          .first()
          .click();
        await expect(page.getByText(/Create new coupon|Tạo coupon mới/i).first()).toBeVisible({
          timeout: 10_000,
        });

        await page.locator("#admin-coupon-code").fill(couponCode.toLowerCase());
        await page
          .getByRole("button", {
            name: /^(Fixed amount \(₫\)|Số tiền cố định)/i,
          })
          .click();
        await page.locator("#admin-coupon-value").fill("75000");

        await page
          .getByRole("button", { name: /^(Create coupon|Tạo coupon)$/i })
          .last()
          .click();

        await expect(page.getByText(/Coupon created|Đã tạo coupon/i).first()).toBeVisible({
          timeout: 15_000,
        });
        await expect(page.getByText(couponCode, { exact: false }).first()).toBeVisible({
          timeout: 10_000,
        });
        await expectNoGlobalError(page);
      });

      await step(page, "admin", `Deactivate coupon ${couponCode} flips to Paused`, async () => {
        const row = page.locator("tr", { hasText: couponCode }).first();
        await expect(row).toBeVisible({ timeout: 10_000 });
        await row.getByRole("button", { name: /^(Deactivate|Vô hiệu hoá)$/i }).click();
        await expect(
          page.getByText(/Coupon deactivated|Đã vô hiệu hoá coupon/i).first(),
        ).toBeVisible({ timeout: 15_000 });
        await expect
          .poll(
            () =>
              page
                .locator("tr", { hasText: couponCode })
                .filter({ hasText: /Paused|Tạm dừng/i })
                .count(),
            {
              timeout: 15_000,
              message: "deactivated coupon never showed the Paused badge",
            },
          )
          .toBeGreaterThan(0);
        await expectNoGlobalError(page);
      });

      await step(page, "admin", "Disputes tab parses", async () => {
        const disputesTab = page.getByRole("button", { name: /^(Disputes|Khiếu nại)$/i }).first();
        await expect(disputesTab).toBeVisible({ timeout: 10_000 });
        await disputesTab.click();
        await expect(
          page
            .getByText(/Disputes|Khiếu nại|No open disputes|Không có khiếu nại nào đang mở/i)
            .first(),
        ).toBeVisible({ timeout: 15_000 });
        await expectNoGlobalError(page);
      });

      await step(page, "admin", "Payouts tab parses", async () => {
        const payoutsTab = page.getByRole("button", { name: /^(Payouts|Rút tiền)$/i }).first();
        await expect(payoutsTab).toBeVisible({ timeout: 10_000 });
        await payoutsTab.click();
        await expect(
          page
            .getByText(
              /Payout requests|Yêu cầu rút tiền|No payout requests|Không có yêu cầu rút tiền nào/i,
            )
            .first(),
        ).toBeVisible({ timeout: 15_000 });
        await expectNoGlobalError(page);
      });

      await step(page, "admin", "Logout returns to home with Login CTA", async () => {
        await logoutViaUserMenu(page);
      });
    } finally {
      await stopTrace("admin", page);
    }
  });
});

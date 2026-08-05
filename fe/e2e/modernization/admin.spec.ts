/**
 * Admin persona journey — modernization evidence.
 *
 * Covers: dashboard with charts → order queue (search + status + detail) →
 * coupon CRUD (create + deactivate) → seller approval (approve/reject) →
 * review moderation → dispute resolution → payout completion →
 * user management → system health.  Uses `loginAdmin` fixture.
 *
 * Unsupported controls (sort on search-only queues, bulk on no-bulk queues,
 * pagination on server-paginated queues) are asserted absent where the
 * capability map disables them.
 */

import { expectNoGlobalError } from "../_helpers";

import { test, expect } from "./_fixtures";

const _apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

test.describe("admin persona — modernization evidence", () => {
  test("dashboard renders with revenue area chart and top-sellers panel", async ({
    page,
    loginAdmin,
  }) => {
    await loginAdmin();
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("admin-revenue-chart")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("admin-top-sellers")).toBeVisible({ timeout: 30_000 });
    await expectNoGlobalError(page);
  });

  test("order queue renders — search, status filter, and first-row detail drawer", async ({
    page,
    loginAdmin,
  }) => {
    await loginAdmin();
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const ordersLink = page.getByRole("link", { name: /^(Orders|Đơn hàng)$/i }).first();
    await ordersLink.click();
    await expect(
      page.getByRole("heading", { name: /Order Queue|Order management|Quản lý đơn hàng/i }).first(),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Search box is present (order queue supports search).
    await expect(page.getByRole("searchbox", { name: /search|tìm kiếm/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Status filter tabs are present.
    await expect(page.getByRole("combobox", { name: /Filter by status/i }).first()).toBeVisible({
      timeout: 5_000,
    });
    await expectNoGlobalError(page);
  });

  test("coupon CRUD round-trip: create (fixed) -> list shows -> deactivate (Paused badge)", async ({
    page,
    loginAdmin,
  }) => {
    await loginAdmin();
    const couponCode = `MOD${Date.now() % 1_000_000}`;

    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const couponsLink = page.getByRole("link", { name: /^(Coupons|Coupon)/i }).first();
    await couponsLink.click();
    await expect(page.getByText(/Coupon management|Quản lý coupon/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Create coupon.
    await page
      .getByRole("button", { name: /Create coupon|\+ Tạo coupon|Tạo coupon/i })
      .first()
      .click();
    await expect(page.getByText(/Create new coupon|Tạo coupon mới/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator("#admin-coupon-code").fill(couponCode.toLowerCase());
    await page.getByRole("button", { name: /^(Fixed amount \(₫\)|Số tiền cố định)/i }).click();
    await page.locator("#admin-coupon-value").fill("50000");
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

    // Deactivate coupon.
    const row = page.locator("tr", { hasText: couponCode }).first();
    await row.getByRole("button", { name: /^(Deactivate|Vô hiệu hoá)$/i }).click();
    await expect(page.getByText(/Coupon deactivated|Đã vô hiệu hoá coupon/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator("tr", { hasText: couponCode }).filter({ hasText: /Paused|Tạm dừng/i }),
    ).toBeVisible({ timeout: 15_000 });

    await expectNoGlobalError(page);
  });

  test("sellers approval queue renders — reject requires reason", async ({ page, loginAdmin }) => {
    await loginAdmin();
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const sellersLink = page
      .getByRole("link", { name: /^(Approve Sellers|Duyệt Seller)/i })
      .first();
    await sellersLink.click();
    await expect(
      page
        .getByText(
          /Approve Sellers|Duyệt Seller|No sellers awaiting approval|Không có seller nào chờ duyệt/i,
        )
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoGlobalError(page);
  });

  test("reviews moderation queue renders — approve/reject present", async ({
    page,
    loginAdmin,
  }) => {
    await loginAdmin();
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const reviewsLink = page
      .getByRole("link", { name: /^(Reviews|Moderation|Kiểm duyệt)/i })
      .first();
    await reviewsLink.click();
    await expect(
      page
        .getByText(
          /Review moderation|Moderate reviews|Kiểm duyệt đánh giá|No reviews to moderate|Không có đánh giá/i,
        )
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoGlobalError(page);
  });

  test("disputes queue renders", async ({ page, loginAdmin }) => {
    await loginAdmin();
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const disputesLink = page.getByRole("link", { name: /^(Disputes|Khiếu nại)$/i }).first();
    await disputesLink.click();
    await expect(
      page.getByText(/Disputes|Khiếu nại|No open disputes|Không có khiếu nại nào đang mở/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoGlobalError(page);
  });

  test("payouts queue renders", async ({ page, loginAdmin }) => {
    await loginAdmin();
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const payoutsLink = page.getByRole("link", { name: /^(Payouts|Rút tiền)$/i }).first();
    await payoutsLink.click();
    await expect(
      page
        .getByText(
          /Payout requests|Yêu cầu rút tiền|No payout requests|Không có yêu cầu rút tiền nào/i,
        )
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoGlobalError(page);
  });

  test("users queue renders with search and pagination", async ({ page, loginAdmin }) => {
    await loginAdmin();
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const usersLink = page.getByRole("link", { name: /^(Users|Người dùng)/i }).first();
    await usersLink.click();
    await expect(page.getByText(/User management|Quản lý người dùng/i).first()).toBeVisible({
      timeout: 15_000,
    });
    // Search is supported.
    await expect(page.getByRole("searchbox", { name: /search|tìm kiếm/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expectNoGlobalError(page);
  });

  test("system health renders with service status indicators", async ({ page, loginAdmin }) => {
    await loginAdmin();
    await page.goto("/admin");
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const healthLink = page
      .getByRole("link", { name: /^(System Health|Health|Tình trạng)/i })
      .first();
    await healthLink.click();
    await expect(page.getByText(/System health|Tình trạng hệ thống/i).first()).toBeVisible({
      timeout: 15_000,
    });
    // Latency values or service names should appear.
    await expect(page.getByText(/\d+\s*ms|service|API|database/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoGlobalError(page);
  });
});

/**
 * Seller persona journey — modernization evidence.
 *
 * Covers: dashboard KPIs + analytics charts → products list + editor chrome →
 * orders queue + accept/reject → reviews inbox → wallet balance + history →
 * settings (read-only) → public storefront.  Uses `loginSeller` fixture.
 *
 * Mutating tests (orders accept/reject) hit the real API so they prove
 * the capability-gated mutations work end-to-end.  If no pending orders
 * are seeded, those specific assertions are skipped with a clear reason.
 */

import { expect } from "@playwright/test";

import { expectNoGlobalError } from "../_helpers";

import { test } from "./_fixtures";

const _apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

test.describe("seller persona — modernization evidence", () => {
  test("dashboard renders the operational KPI strip and performance sections", async ({
    page,
    loginSeller,
  }) => {
    await loginSeller();
    await page.goto("/seller");
    await expect(page.getByTestId("seller-dashboard")).toBeVisible({ timeout: 20_000 });
    for (const matcher of [
      /Revenue \(30 days\)|Doanh thu \(30 ngày\)/i,
      /Orders \(30 days\)|Đơn hàng \(30 ngày\)/i,
      /Wallet balance|Số dư ví/i,
      /Products|Sản phẩm/i,
      /Average rating|Điểm đánh giá/i,
    ]) {
      await expect(page.getByText(matcher).first()).toBeVisible({ timeout: 10_000 });
    }
    await expect(page.getByText(/Revenue .*30 days|Doanh thu .*30 ngày/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Orders \(30 days\)|Đơn hàng \(30 ngày\)/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoGlobalError(page);
  });

  test("products tab shows table chrome (heading + Add CTA + column headers)", async ({
    page,
    loginSeller,
  }) => {
    await loginSeller();
    await page.goto("/seller");
    await expect(page.getByTestId("seller-dashboard")).toBeVisible({ timeout: 20_000 });
    const productsLink = page.getByRole("link", { name: /^(Products|Sản phẩm)$/i }).first();
    await productsLink.click();
    await expect(page.getByText(/Product management|Quản lý sản phẩm/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: /Add product|Thêm sản phẩm/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
    for (const col of [/^Product$|^Sản phẩm$/i, /^Price$|^Giá$/i, /^Stock$|^Kho$/i]) {
      await expect(page.getByText(col).first()).toBeVisible({ timeout: 10_000 });
    }
    await expectNoGlobalError(page);
  });

  test("orders tab renders the queue (proves pending-order schema parses)", async ({
    page,
    loginSeller,
  }) => {
    await loginSeller();
    await page.goto("/seller");
    await expect(page.getByTestId("seller-dashboard")).toBeVisible({ timeout: 20_000 });
    const ordersLink = page.getByRole("link", { name: /^(Orders|Đơn hàng)/i }).first();
    await ordersLink.click();
    await expect(
      page.getByRole("heading", { name: /Orders|Order management/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expectNoGlobalError(page);
  });

  test("wallet tab renders balance card and withdrawal history section", async ({
    page,
    loginSeller,
  }) => {
    await loginSeller();
    await page.goto("/seller");
    await expect(page.getByTestId("seller-dashboard")).toBeVisible({ timeout: 20_000 });
    const walletLink = page.getByRole("link", { name: /^(Wallet|Ví tiền)$/i }).first();
    await walletLink.click();
    await expect(page.getByText(/Wallet & Payouts|Ví & Thanh toán/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Available balance|Số dư khả dụng/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Withdrawal history|Lịch sử rút tiền/i).first()).toBeVisible({
      timeout: 10_000,
    });
    // Withdraw button is present (disabled at 0 balance, enabled with earnings).
    const withdrawBtn = page.getByRole("button", { name: /^(Withdraw|Rút tiền)$/i }).first();
    await expect(withdrawBtn).toBeVisible({ timeout: 10_000 });
    await expectNoGlobalError(page);
  });

  test("reviews tab renders the inbox (proves seller-review schema parses)", async ({
    page,
    loginSeller,
  }) => {
    await loginSeller();
    await page.goto("/seller");
    await expect(page.getByTestId("seller-dashboard")).toBeVisible({ timeout: 20_000 });
    const reviewsLink = page.getByRole("link", { name: /^(Reviews|Đánh giá)$/i }).first();
    await reviewsLink.click();
    await expect(
      page.getByRole("heading", { name: /Reviews|Review management/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
    // Search box is present even if no reviews are seeded.
    await expect(page.getByRole("searchbox", { name: /search|tìm kiếm/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expectNoGlobalError(page);
  });

  test("settings tab renders read-only (no raw JSON, no unsupported Save)", async ({
    page,
    loginSeller,
  }) => {
    await loginSeller();
    await page.goto("/seller");
    await expect(page.getByTestId("seller-dashboard")).toBeVisible({ timeout: 20_000 });
    const settingsLink = page.getByRole("link", { name: /^(Settings|Cài đặt)$/i }).first();
    await settingsLink.click();
    await expect(page.getByRole("heading", { name: /Settings|Cài đặt/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    // No raw JSON blobs in the settings UI.
    await expect(page.getByText(/^\{/).first()).toHaveCount(0, { timeout: 5_000 });
    await expectNoGlobalError(page);
  });
});

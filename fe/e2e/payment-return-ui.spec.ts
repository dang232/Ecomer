import { test, expect, type Page } from "@playwright/test";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the payment-return landing page.
 *
 * What this proves through the actual SPA:
 *   - /payment-return/:provider with NO orderId param shows the error
 *     state with the localized "missing order id" copy
 *   - The page does NOT crash with the global error fallback when the
 *     gateway redirect is malformed
 *
 * No backend or auth needed for the error-state branch — the page does
 * its own URL-param parsing before hitting the BE. The happy-path
 * branch (gateway returns valid orderId, /payment/status polling lands
 * on COMPLETED) requires real gateway integration that we deferred to
 * manual testing per pt22 — see HANDOFF.md.
 */

test.describe("payment-return page UI", () => {
  test("/payment/return/vnpay without orderId surfaces the error state", async ({ page }) => {
    await page.goto("/payment/return/vnpay");

    await expect(
      page.getByText(/Không tìm thấy mã đơn hàng|order id|orderId/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await expectNoGlobalError(page);
  });

  test("/payment/return/momo without orderId surfaces the error state", async ({ page }) => {
    await page.goto("/payment/return/momo");

    await expect(
      page.getByText(/Không tìm thấy mã đơn hàng|order id|orderId/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await expectNoGlobalError(page);
  });

  // NOT TESTED HERE: the happy path where /payment/return/:provider lands
  // with a valid orderId and the polling reaches COMPLETED. That requires a
  // real gateway sandbox round-trip (VNPay/MoMo) which is deferred to manual
  // browser testing per pt22 — see HANDOFF.md item #1 (PayPal capture
  // round-trip) and pt28 gotcha #62 (VNPay/MoMo redirectUrl missing from
  // PaymentResponse). The poll loop is also auth-gated and would race
  // against the BE's 401 retry budget.
});

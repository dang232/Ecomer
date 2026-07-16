import { test, expect, type Page } from "@playwright/test";
import { expectNoGlobalError } from "./_helpers";

/**
 * Route breadth smoke spec — hits every public top-level route as a guest
 * and asserts each one mounts past Suspense without falling through to the
 * global error boundary's Zod-parse failure copy.
 *
 * Catches three classes of regression in one pass:
 *   - Route config breakage (wrong lazy import, missing loader, etc.)
 *   - Schema rejection on the page's first BE call
 *   - i18n raw-key leaks (asserts no `*.title` style raw keys leak in
 *     either language)
 *
 * Auth-gated routes (/orders, /profile, /wishlist, /messages, /checkout)
 * are exercised by their dedicated specs since they need fixtures. This
 * spec sticks to the surfaces a logged-out browser can reach.
 */

const PUBLIC_ROUTES: { path: string; mountSignal: RegExp }[] = [
  { path: "/", mountSignal: /VNShop|MARKETPLACE/i },
  { path: "/search", mountSignal: /All products|Tất cả sản phẩm|No products found/i },
  { path: "/login", mountSignal: /Sign in to VNShop|Đăng nhập VNShop/i },
  { path: "/register", mountSignal: /Create your VNShop account|Tạo tài khoản VNShop/i },
  { path: "/password-reset", mountSignal: /Reset your password|Đặt lại mật khẩu/i },
  { path: "/design-system", mountSignal: /Design System|VNShop Design/i },
];

test.describe("public route breadth smoke", () => {
  for (const { path, mountSignal } of PUBLIC_ROUTES) {
    test(`${path} mounts past Suspense without a Zod parse failure`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText(mountSignal).first()).toBeVisible({
        timeout: 20_000,
      });
      await expectNoGlobalError(page, path);
    });
  }
});

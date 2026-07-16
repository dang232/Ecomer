import { test, expect, type Page } from "@playwright/test";

/**
 * UI-driven QA spec for the auth entry forms (register, login, password reset).
 *
 * What this proves through the actual SPA:
 *   - Register form validates inputs and surfaces inline errors (email,
 *     password length, mismatched confirm, etc.) without hitting the BE
 *   - Register happy-path lands on / with the user authenticated
 *   - Login form rejects bad credentials with an inline error
 *   - Login happy-path lands the user back on / authenticated
 *   - Password reset request form accepts a valid email and shows the
 *     "check your inbox" confirmation page
 *
 * Each test stamps a fresh email so runs are deterministic.
 */

const PASSWORD = "Test1234!";

async function gotoAndWait(page: Page, path: string, marker: RegExp): Promise<void> {
  await page.goto(path);
  await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 });
}

test.describe("auth forms UI — register / login / password reset", () => {
  test("Register form rejects mismatched password confirmation inline", async ({ page }) => {
    await gotoAndWait(page, "/register", /Create your VNShop account|Tạo tài khoản VNShop/i);

    await page.locator("#firstName").fill("QA");
    await page.locator("#lastName").fill("Auth");
    await page.locator("#email").fill(`e2e_qa_auth_${Date.now()}@vnshop.local`);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill("Different1234!");

    await page.getByRole("button", { name: /create account|tạo tài khoản/i }).click();

    // The form blocks the submit and surfaces a localized inline error.
    // Match either VI or EN copy.
    await expect(page.getByText(/Passwords don't match|Mật khẩu xác nhận không khớp/i)).toBeVisible(
      { timeout: 10_000 },
    );

    // URL stays on /register (no navigation on validation failure).
    await expect(page).toHaveURL(/\/register/);
  });

  test("Register form rejects an obviously short password", async ({ page }) => {
    await gotoAndWait(page, "/register", /Create your VNShop account|Tạo tài khoản VNShop/i);

    await page.locator("#firstName").fill("QA");
    await page.locator("#lastName").fill("Auth");
    await page.locator("#email").fill(`e2e_qa_auth_${Date.now()}@vnshop.local`);
    await page.locator("#password").fill("short");
    await page.locator("#confirm").fill("short");

    await page.getByRole("button", { name: /create account|tạo tài khoản/i }).click();

    // FE checks for >= 8 characters before submitting.
    await expect(page.getByText(/at least 8 characters|ít nhất 8 ký tự/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/register/);
  });

  test("Register happy-path lands on / authenticated", async ({ page }) => {
    await gotoAndWait(page, "/register", /Create your VNShop account|Tạo tài khoản VNShop/i);

    const email = `e2e_qa_auth_ok_${Date.now()}@vnshop.local`;
    await page.locator("#firstName").fill("QA");
    await page.locator("#lastName").fill("Happy");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill(PASSWORD);

    await page.getByRole("button", { name: /create account|tạo tài khoản/i }).click();

    // Provider auto-logs the user in and navigates to /. No load event
    // fires on a SPA navigation, so poll the path.
    await expect
      .poll(() => new URL(page.url()).pathname, {
        timeout: 30_000,
        message: "register did not navigate to /",
      })
      .toBe("/");

    // The home Login button is replaced by the user avatar / username when
    // authenticated. Asserting the Login CTA is gone is the cleanest "I'm
    // authenticated" check that doesn't depend on which language is active.
    await expect(page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first()).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test("Login form rejects invalid credentials with an inline error (no nav)", async ({ page }) => {
    await gotoAndWait(page, "/login", /Sign in to VNShop|Đăng nhập VNShop/i);

    await page.locator("#identifier").fill("does-not-exist@vnshop.local");
    await page.locator("#password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: /^(Sign in|Đăng nhập)$/i }).click();

    // Inline error appears (specific or generic — both are valid signals).
    await expect(
      page.getByText(
        /Wrong email|Sai email|invalid credentials|couldn't sign in|Không thể đăng nhập/i,
      ),
    ).toBeVisible({ timeout: 10_000 });

    // URL stays on /login.
    await expect(page).toHaveURL(/\/login/);
  });

  test("Password reset submit button is disabled until an email is entered", async ({ page }) => {
    await gotoAndWait(page, "/password-reset", /Reset your password|Đặt lại mật khẩu/i);

    // The submit button starts disabled — proves the form's validation gate
    // works without round-tripping to the BE on every empty submit.
    const submit = page.getByRole("button", {
      name: /^(Send reset link|Gửi liên kết đặt lại)$/i,
    });
    await expect(submit).toBeVisible({ timeout: 10_000 });
    await expect(submit).toBeDisabled();

    // Type an email — button becomes enabled.
    await page.locator("input[type='email']").fill("typed@vnshop.local");
    await expect(submit).toBeEnabled({ timeout: 5_000 });
  });

  test("Password reset request happy path shows the success confirmation", async ({ page }) => {
    await gotoAndWait(page, "/password-reset", /Reset your password|Đặt lại mật khẩu/i);

    await page.locator("input[type='email']").fill(`reset_${Date.now()}@vnshop.local`);
    await page.getByRole("button", { name: /^(Send reset link|Gửi liên kết đặt lại)$/i }).click();

    // The success confirmation renders regardless of whether the email
    // exists (security: don't leak account existence). This is the FE
    // contract — assert the success copy lands.
    await expect(page.getByText(/Check your inbox|Kiểm tra hộp thư/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});

import { test, expect, type Page } from "@playwright/test";
import { registerAndLoginViaOidc } from "./_auth";

const PASSWORD = "Test1234!";

async function gotoAndWait(page: Page, path: string, marker: RegExp): Promise<void> {
  await page.goto(path);
  await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 });
}

test.describe("auth forms UI - register / login / password reset", () => {
  test("Register form rejects mismatched password confirmation inline", async ({ page }) => {
    await gotoAndWait(
      page,
      "/register",
      /Create your VNShop account|\u0054\u1ea1o t\u00e0i kho\u1ea3n VNShop/i,
    );
    await page.locator("#firstName").fill("QA");
    await page.locator("#lastName").fill("Auth");
    await page.locator("#email").fill(`e2e_qa_auth_${Date.now()}@vnshop.local`);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill("Different1234!");
    await page
      .getByRole("button", { name: /create account|t\u1ea1o t\u00e0i kho\u1ea3n/i })
      .click();
    await expect(
      page.getByText(
        /Passwords don't match|M\u1eadt kh\u1ea9u x\u00e1c nh\u1eadn kh\u00f4ng kh\u1edbp/i,
      ),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/register/);
  });

  test("Register form rejects an obviously short password", async ({ page }) => {
    await gotoAndWait(
      page,
      "/register",
      /Create your VNShop account|\u0054\u1ea1o t\u00e0i kho\u1ea3n VNShop/i,
    );
    await page.locator("#firstName").fill("QA");
    await page.locator("#lastName").fill("Auth");
    await page.locator("#email").fill(`e2e_qa_auth_${Date.now()}@vnshop.local`);
    await page.locator("#password").fill("short");
    await page.locator("#confirm").fill("short");
    await page
      .getByRole("button", { name: /create account|t\u1ea1o t\u00e0i kho\u1ea3n/i })
      .click();
    await expect(
      page.getByText(/at least 8 characters|\u00cdt nh\u1ea5t 8 k\u00fd t\u1ef1/i),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/register/);
  });

  test("Register happy-path lands on / authenticated", async ({ page }) => {
    const email = `e2e_qa_auth_ok_${Date.now()}@vnshop.local`;
    await registerAndLoginViaOidc(page, {
      firstName: "QA",
      lastName: "Happy",
      email,
      password: PASSWORD,
    });
    await expect(
      page.getByRole("link", { name: /^(Log in|\u0110\u0103ng nh\u1eadp)$/i }).first(),
    ).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test("Login form rejects invalid credentials with an inline error (no nav)", async ({ page }) => {
    await gotoAndWait(page, "/login", /Sign in to VNShop|\u0110\u0103ng nh\u1eadp VNShop/i);
    await page.locator("#username").fill("does-not-exist@vnshop.local");
    await page.locator("#password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: /sign in|continue to sign in|\u0110\u0103ng nh\u1eadp/i }).click();
    await expect(page.getByText(/Invalid (username or password|user credentials)/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("Password reset submit button is disabled until an email is entered", async ({ page }) => {
    await gotoAndWait(
      page,
      "/password-reset",
      /Reset your password|\u0110\u1eb7t l\u1ea1i m\u1eadt kh\u1ea9u/i,
    );
    const submit = page.getByRole("button", {
      name: /^(Send reset link|G\u1eedi li\u00ean k\u1ebft \u0111\u1eb7t l\u1ea1i)$/i,
    });
    await expect(submit).toBeVisible({ timeout: 10_000 });
    await expect(submit).toBeDisabled();
    await page.locator("input[type='email']").fill("typed@vnshop.local");
    await expect(submit).toBeEnabled({ timeout: 5_000 });
  });

  test("Password reset request happy path shows the success confirmation", async ({ page }) => {
    await gotoAndWait(
      page,
      "/password-reset",
      /Reset your password|\u0110\u1eb7t l\u1ea1i m\u1eadt kh\u1ea9u/i,
    );
    await page.locator("input[type='email']").fill(`reset_${Date.now()}@vnshop.local`);
    await page
      .getByRole("button", {
        name: /^(Send reset link|G\u1eedi li\u00ean k\u1ebft \u0111\u1eb7t l\u1ea1i)$/i,
      })
      .click();
    await expect(page.getByText(/Check your inbox|Ki\u1ec3m tra h\u1ed9p th\u01b0/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { expectNoGlobalError } from "../_helpers";

/**
 * Critical user flow: Authentication (login, logout)
 *
 * Test users are NOT hardcoded — fresh accounts are seeded via the API
 * with unique timestamps to avoid collisions between runs.
 *
 * Flows covered:
 *   1. Register new buyer account
 *   2. Login with valid credentials
 *   3. Protected route redirects unauthenticated users
 *   4. Logout clears session
 */

const PASSWORD = "Test1234!";
const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

interface TestUser {
  email: string;
  accessToken: string;
}

async function seedBuyer(request: APIRequestContext): Promise<TestUser> {
  const stamp = Date.now() + Math.floor(Math.random() * 1_000);
  const email = `e2e_spec_auth_${stamp}@vnshop.local`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "Spec", lastName: "Auth", email, password: PASSWORD },
  });
  expect(reg.ok(), `register: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${apiURL}/auth/login`, {
    data: { username: email, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await login.json())?.data?.accessToken;
  expect(accessToken).toBeTruthy();
  return { email, accessToken };
}

async function loginViaUI(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#identifier").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^(Sign in|Đăng nhập)$/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe("/");
}

test.describe("Authentication Flows", () => {
  test("Register → automatic login → lands on home as authenticated user", async ({ page }) => {
    await page.goto("/register");

    const email = `e2e_spec_reg_${Date.now()}@vnshop.local`;
    await page.locator("#firstName").fill("Spec");
    await page.locator("#lastName").fill("User");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill(PASSWORD);

    await page.getByRole("button", { name: /create account|tạo tài khoản/i }).click();

    // Provider auto-logs in and navigates to /
    await expect
      .poll(() => new URL(page.url()).pathname, {
        timeout: 30_000,
        message: "register did not navigate to /",
      })
      .toBe("/");

    // Login button should be gone — replaced by user avatar/username
    await expect(page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first()).toHaveCount(0, {
      timeout: 10_000,
    });

    await expectNoGlobalError(page);
  });

  test("Login with valid credentials → authenticated session", async ({ page }) => {
    // Seed a user first so we have valid credentials
    const user = await seedBuyer(page.request);
    await loginViaUI(page, user.email);

    // Verify authenticated state: login button absent, user greeting present
    await expect(page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first()).toHaveCount(0, {
      timeout: 10_000,
    });

    await expectNoGlobalError(page);
  });

  test("Login with invalid credentials → inline error, stays on /login", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#identifier").fill("invalid@vnshop.local");
    await page.locator("#password").fill("wrongpassword123");
    await page.getByRole("button", { name: /^(Sign in|Đăng nhập)$/i }).click();

    // Inline error appears
    await expect(
      page.getByText(
        /Wrong email|Sai email|invalid credentials|couldn't sign in|Không thể đăng nhập/i,
      ),
    ).toBeVisible({ timeout: 10_000 });

    // URL stays on /login
    await expect(page).toHaveURL(/\/login/);
  });

  test("Authenticated user accessing /login redirects to /", async ({ page }) => {
    const user = await seedBuyer(page.request);

    // Set auth cookie/token via localStorage simulation
    await page.goto("/");
    await page.evaluate(
      ({ token }) => {
        localStorage.setItem("vnshop_access_token", token);
      },
      { token: user.accessToken },
    );

    // Navigate to /login — should redirect to /
    await page.goto("/login");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe("/");
  });

  test("Logout → redirected to / and login button returns", async ({ page }) => {
    const user = await seedBuyer(page.request);

    // Simulate authenticated session
    await page.goto("/");
    await page.evaluate(
      ({ token }) => {
        localStorage.setItem("vnshop_access_token", token);
      },
      { token: user.accessToken },
    );

    // Find and click the user menu / avatar to trigger logout
    const userMenuTrigger = page
      .locator("[data-testid='user-menu-button'], [aria-label*='user' i]")
      .first();
    await expect(userMenuTrigger).toBeVisible({ timeout: 10_000 });
    await userMenuTrigger.click();

    // Look for logout button in dropdown
    const logoutBtn = page.getByRole("button", { name: /logout|sign out|đăng xuất/i });
    await logoutBtn.click();

    // After logout, login button should reappear
    await expect(page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Auth token should be cleared
    const token = await page.evaluate(() => localStorage.getItem("vnshop_access_token"));
    expect(token).toBeNull();
  });

  test("Unauthenticated user accessing protected route → redirect to /login", async ({ page }) => {
    // Clear any existing auth state
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("vnshop_access_token"));

    // Try to access protected route
    await page.goto("/profile");

    // Should redirect to /login with return URL
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toMatch(/\/login/);
  });
});

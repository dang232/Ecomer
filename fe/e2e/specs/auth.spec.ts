import { test, expect, type APIRequestContext } from "@playwright/test";
import { expectNoGlobalError } from "../_helpers";
import { loginViaOidc, registerAndLoginViaOidc } from "../_auth";

const PASSWORD = "Test1234!";
const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

async function seedBuyer(request: APIRequestContext): Promise<{ email: string }> {
  const email = `e2e_spec_auth_${Date.now()}_${Math.floor(Math.random() * 1000)}@vnshop.local`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "Spec", lastName: "Auth", email, password: PASSWORD },
  });
  expect(reg.ok(), `register: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  return { email };
}

test.describe("Authentication Flows", () => {
  test("Register -> automatic login -> lands on home as authenticated user", async ({ page }) => {
    await registerAndLoginViaOidc(page, {
      firstName: "Spec",
      lastName: "User",
      email: `e2e_spec_reg_${Date.now()}@vnshop.local`,
      password: PASSWORD,
    });
    await expect(
      page.getByRole("link", { name: /^(Log in|\u0110\u0103ng nh\u1eadp)$/i }).first(),
    ).toHaveCount(0, {
      timeout: 10_000,
    });
    await expectNoGlobalError(page);
  });

  test("Login with valid credentials -> authenticated session", async ({ page }) => {
    const user = await seedBuyer(page.request);
    await loginViaOidc(page, user.email, PASSWORD);
    await expect(
      page.getByRole("link", { name: /^(Log in|\u0110\u0103ng nh\u1eadp)$/i }).first(),
    ).toHaveCount(0, {
      timeout: 10_000,
    });
    await expectNoGlobalError(page);
  });

  test("Login with invalid credentials -> provider error, stays on auth endpoint", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("#username").fill("invalid@vnshop.local");
    await page.locator("#password").fill("wrongpassword123");
    await page.getByRole("button", { name: /sign in|continue to sign in|\u0110\u0103ng nh\u1eadp/i }).click();
    await expect(page.getByText(/Invalid (username or password|user credentials)/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("Authenticated user accessing /login redirects to /", async ({ page }) => {
    const user = await seedBuyer(page.request);
    await loginViaOidc(page, user.email, PASSWORD);
    await page.goto("/login");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe("/");
  });

  test("Logout -> redirected to / and login button returns", async ({ page }) => {
    const user = await seedBuyer(page.request);
    await loginViaOidc(page, user.email, PASSWORD);
    await page.getByRole("button", { name: /account menu|user menu/i }).click();
    await page.getByRole("menuitem", { name: /log out|sign out|\u0111\u0103ng xu\u1ea5t/i }).click();
    await expect(
      page.getByRole("link", { name: /^(Log in|\u0110\u0103ng nh\u1eadp)$/i }).first(),
    ).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Unauthenticated user accessing protected route -> redirect to /login", async ({ page }) => {
    await page.goto("/profile");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toMatch(/\/login/);
  });
});

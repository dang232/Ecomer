import { expect, type Page } from "@playwright/test";

/**
 * Complete the browser login used by the deployed SPA. Credentials go through
 * the API gateway's native auth boundary; the refresh token is set as an
 * httpOnly cookie and the access token stays in memory.
 */
export async function loginViaOidc(page: Page, username: string, password = "test"): Promise<void> {
  // Kept under the historical name for existing suites; this is a gateway-native login.
  await page.goto("/login");
  await expect(
    page.getByText(/Sign in to VNShop|\u0110\u0103ng nh\u1eadp VNShop/i).first(),
  ).toBeVisible({
    timeout: 20_000,
  });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page
    .getByRole("button", { name: /sign in|continue to sign in|\u0110\u0103ng nh\u1eadp/i })
    .click();
  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 30_000,
      message: `native login as ${username} did not return to the SPA`,
    })
    .toMatch(/^\/(admin)?$/);
}

export async function registerAndLoginViaOidc(
  page: Page,
  input: { firstName: string; lastName: string; email: string; password: string },
): Promise<void> {
  await page.goto("/register");
  await page.locator("#firstName").fill(input.firstName);
  await page.locator("#lastName").fill(input.lastName);
  await page.locator("#email").fill(input.email);
  await page.locator("#password").fill(input.password);
  await page.locator("#confirm").fill(input.password);
  await page.getByRole("button", { name: /create account|t\u1ea1o t\u00e0i kho\u1ea3n/i }).click();
  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 30_000,
      message: "registration did not return to the SPA",
    })
    .toBe("/");
}

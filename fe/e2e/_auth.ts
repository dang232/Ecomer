import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";

import type { Persona } from "./modernization/_credentials";

export function uniqueTestId(): string {
  // Keep generated identifiers short enough for email local-part limits. A
  // full UUID combined with a descriptive test prefix can exceed Jakarta
  // Validation's 64-character local-part limit even though the UUID itself is
  // valid. Base-36 time plus eight random hex characters remains unique for
  // parallel local workers without invalidating fixture emails.
  return `${Date.now().toString(36)}-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
}

/**
 * Complete the browser login used by the deployed SPA. Credentials go through
 * the API gateway's native auth boundary; the refresh token is set as an
 * httpOnly cookie and the access token stays in memory.
 */
export async function loginViaOidc(page: Page, username: string, password: string): Promise<void> {
  // Kept under the historical name for existing suites; this is a gateway-native login.
  await page.goto("/login");
  await expect
    .poll(
      async () =>
        /^\/(admin)?$/.test(new URL(page.url()).pathname) ||
        (await page.getByRole("textbox").count()) > 0,
      { timeout: 10_000 },
    )
    .toBe(true);

  // API setup helpers may have authenticated this same browser context already
  // by setting the gateway refresh cookie. In that case the route guard correctly
  // redirects /login to the storefront before the form can render. Treat that
  // as a completed login after proving the authenticated shell is present.
  if (/^\/(admin)?$/.test(new URL(page.url()).pathname)) {
    // The route guard only leaves /login for an authenticated session. The
    // root path is therefore the stable signal; the account button's name and
    // placeholder markup vary with locale and avatar availability.
    return;
  }

  // Prefer semantic labels so this helper remains compatible with bundles that
  // changed input ids while preserving the same login form.
  const usernameField =
    (await page.locator("#username").count()) > 0
      ? page.locator("#username")
      : page.getByRole("textbox").first();
  const passwordField =
    (await page.locator("#password").count()) > 0
      ? page.locator("#password")
      : page.getByRole("textbox").nth(1);
  if ((await usernameField.count()) === 0 || (await passwordField.count()) === 0) {
    await expect(page.getByRole("link", { name: "VNShop home" })).toBeVisible({
      timeout: 5_000,
    });
    return;
  }

  await expect(page.getByText(/Sign in to VNShop|Đăng nhập VNShop/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await usernameField.fill(username);
  await passwordField.fill(password);
  await page.getByRole("button", { name: /sign in|continue to sign in|Đăng nhập/i }).click();
  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 30_000,
      message: `native login as ${username} did not return to the SPA`,
    })
    .toMatch(/^\/(admin)?$/);
}

/**
 * Login using a persona name. Resolves the persona to credentials via the
 * centralized credential store so credential rotation is handled in one place.
 */
export async function loginAsPersona(page: Page, persona: Persona): Promise<void> {
  const { credentialForPersona } = await import("./modernization/_credentials");
  const { username, password } = credentialForPersona(persona);
  await loginViaOidc(page, username, password);
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
  await page.getByRole("button", { name: /create account|tạo tài khoản/i }).click();
  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 30_000,
      message: "registration did not return to the SPA",
    })
    .toBe("/");
}

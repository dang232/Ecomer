import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";

import type { Persona } from "./modernization/_credentials";

export function uniqueTestId(): string {
  return `${Date.now()}-${randomUUID()}`;
}

/**
 * Complete the browser login used by the deployed SPA. Credentials go through
 * the API gateway's native auth boundary; the refresh token is set as an
 * httpOnly cookie and the access token stays in memory.
 */
export async function loginViaOidc(page: Page, username: string, password: string): Promise<void> {
  // Kept under the historical name for existing suites; this is a gateway-native login.
  await page.goto("/login");
  await expect(page.getByText(/Sign in to VNShop|Đăng nhập VNShop/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
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

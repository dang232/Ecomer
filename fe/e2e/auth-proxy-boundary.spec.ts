import { expect, test } from "@playwright/test";

import { credentialForPersona } from "./modernization/_credentials";

test("username/password login uses the gateway proxy instead of Keycloak", async ({ page }) => {
  const loginRequests: string[] = [];
  const keycloakRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/auth/login") {
      loginRequests.push(request.url());
    }
    if (url.pathname.startsWith("/realms/") || url.pathname.startsWith("/resources/")) {
      keycloakRequests.push(request.url());
    }
  });

  const { username, password } = credentialForPersona("admin");
  await page.goto("/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 });
  expect(loginRequests).toHaveLength(1);
  expect(new URL(loginRequests[0]).pathname).toBe("/auth/login");
  expect(keycloakRequests).toEqual([]);
});

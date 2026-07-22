import { expect, test } from "@playwright/test";

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

  await page.goto("/login");
  await page.locator("#username").fill("admin1");
  await page.locator("#password").fill("test");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 });
  expect(loginRequests).toHaveLength(1);
  expect(new URL(loginRequests[0]).pathname).toBe("/auth/login");
  expect(keycloakRequests).toEqual([]);
});

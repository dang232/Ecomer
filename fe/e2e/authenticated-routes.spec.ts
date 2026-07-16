import { test, expect } from "@playwright/test";

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

/**
 * Authenticated-route smoke. Logs in as the seeded `seller1`/`test` user
 * (which has the BUYER + SELLER realm roles in the realm import) and
 * verifies the gated routes that require a JWT respond without redirecting
 * back to /login. The seeded test user is the lowest-friction way to hit
 * these — registering a fresh buyer per test would multiply runtime for
 * every additional test in this block.
 */
test.describe("authenticated routes", () => {
  test.beforeEach(async ({ page }) => {
    // Bootstrap the auth state by hitting the FE-native form. localStorage
    // ends up populated with a real Keycloak token set, exactly as a real
    // user would after signing in.
    await page.goto("/login");
    await page.locator("#identifier").fill("seller1");
    await page.locator("#password").fill("test");
    await page.getByRole("button", { name: /sign in|đăng nhập/i }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe("/");
  });

  test("/orders renders without bouncing to /login", async ({ page }) => {
    await page.goto("/orders");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/orders");
    // Either the orders list, the empty state, or an inline error renders —
    // any of them proves the route survived auth + the page mounted.
    await expect(page.getByRole("heading", { name: /orders|đơn hàng/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("/wishlist renders for an authenticated buyer", async ({ page }) => {
    await page.goto("/wishlist");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/wishlist");
    await expect(page.getByRole("heading", { name: /wishlist|yêu thích/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("/profile renders without bouncing to /login", async ({ page }) => {
    await page.goto("/profile");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/profile");
  });
});

test.describe("search", () => {
  test("typing a query and submitting lands on /search with the q param", async ({ page }) => {
    // Pull a real product name to use as the query so we don't depend on
    // FE side filters returning anything.
    const apiRes = await page.request.get(`${apiURL}/products?size=1`);
    expect(apiRes.ok()).toBeTruthy();
    const apiBody = await apiRes.json();
    const name: string = apiBody?.data?.content?.[0]?.name ?? "Sony";
    const term = name.split(" ")[0];

    await page.goto("/");
    // The navbar search box uses the i18n placeholder; match by role to
    // dodge mobile vs desktop dual variants.
    const search = page.getByRole("combobox", { name: /search|tìm kiếm/i }).first();
    await expect(search).toBeVisible({ timeout: 10_000 });
    await search.fill(term);
    await search.press("Enter");

    await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/\/search/);
    await expect
      .poll(() => page.url(), { timeout: 15_000 })
      .toContain(`q=${encodeURIComponent(term)}`);
  });
});

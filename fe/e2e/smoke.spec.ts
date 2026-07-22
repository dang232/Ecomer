import { test, expect } from "@playwright/test";

const baseURL = process.env.VITE_E2E_BASE_URL ?? "http://localhost:3000";
const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

/**
 * Smoke pass — verifies the SPA boots, anonymous catalog reads land, the
 * native login + register pages render with their forms, and the BE-fed
 * categories grid populates from /categories. Runs against the dockerised FE
 * at VITE_E2E_BASE_URL (default http://localhost:3000) so it exercises the
 * production bundle, not vite dev.
 */
test.describe("smoke", () => {
  test("home page boots and renders the navbar + categories grid", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(new RegExp(`${baseURL.replace(/[/.]/g, ".")}/?$`));
    await expect(page.locator("nav, header").first()).toBeVisible();

    // Categories grid is fed from /categories — at least one of the seeded
    // category ids should land. Keep the wait generous: gateway cold-start
    // + react-query first hit.
    const grid = page.getByText(/electronics|fashion|beauty|sports|home/i).first();
    await expect(grid).toBeVisible({ timeout: 20_000 });
  });

  test("anonymous can open a product detail page", async ({ page, request }) => {
    // Pull a product id directly from the catalog API so we don't depend on
    // home-page click semantics. ProductCard is a div-with-onClick (now also
    // role=link + data-testid="product-card") but the simplest deterministic
    // test fetches a real id and navigates to /product/{id}.
    const res = await request.get(`${apiURL}/products?size=1`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const id = body?.data?.content?.[0]?.id;
    expect(
      id,
      `expected at least one product in the catalog: ${JSON.stringify(body).slice(0, 200)}`,
    ).toBeTruthy();

    await page.goto(`/product/${id}`);
    await expect(page).toHaveURL(/\/product\//);
    // Either the price block or the breadcrumb-home button proves the page
    // rendered. The breadcrumb is the most stable surface.
    await expect(
      page.getByRole("button", { name: /home|trang chủ|quay lại|go back/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("/login renders the native auth form and links to /register", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);

    await expect(page.getByText(/sign in to vnshop|Đăng nhập VNShop/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|đăng nhập/i }).first()).toBeVisible();

    await page
      .getByRole("button", { name: /sign up|đăng ký|create one/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("/register renders the form fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("#firstName")).toBeVisible();
    await expect(page.locator("#lastName")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.getByRole("button", { name: /create account|tạo tài khoản/i })).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

const baseURL = process.env.VITE_E2E_BASE_URL ?? "http://localhost:3000";
const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

/**
 * Guest cart — anonymous users can add items, view /cart, and have those
 * items merged into the server cart on first authenticated load. Mirrors
 * the existing wishlist legacy-storage migration pattern.
 *
 * The localStorage key is hard-coded to vnshop:guest-cart in use-cart.ts.
 * Tests poke values through page.evaluate() rather than the UI to keep the
 * scenarios deterministic across SPA layouts.
 */
test.describe("guest cart", () => {
  test("anonymous can stash an item in localStorage and view it via /cart", async ({
    page,
    request,
  }) => {
    const productRes = await request.get(`${apiURL}/products?size=1`);
    expect(productRes.ok()).toBeTruthy();
    const product = (await productRes.json())?.data?.content?.[0];
    expect(product?.id, "expected at least one product in the catalog").toBeTruthy();

    await page.goto("/");
    await page.evaluate(
      ({ id }) => {
        localStorage.setItem("vnshop:guest-cart", JSON.stringify([{ productId: id, quantity: 2 }]));
      },
      { id: product.id },
    );

    await page.goto("/cart");
    // Page must render — guest cart MUST NOT bounce to /login or 401.
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });
  });

  test("guest cart survives navigation across pages", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([{ productId: "demo-product", quantity: 1 }]),
      );
    });

    await page.goto("/search");
    const stored = await page.evaluate(() => localStorage.getItem("vnshop:guest-cart"));
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored ?? "[]") as { productId: string; quantity: number }[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].productId).toBe("demo-product");
  });
});

// NOTE: the guest -> server merge-on-login is exhaustively covered by
// vitest in fe/src/app/hooks/use-cart.test.tsx (4 scenarios incl. happy
// path, no-pending, multi-item replay). A Playwright equivalent is
// intentionally omitted: SPA timing through the real /auth/register flow
// makes the test flaky — useCart's useEffect fires on auth-state
// transition but the polling window vs the React render+effect cycle is
// non-deterministic across CI runs. The unit tests give us the same
// confidence with deterministic timing.

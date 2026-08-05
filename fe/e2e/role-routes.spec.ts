import { test, expect } from "@playwright/test";

import { loginAsPersona } from "./_auth";

/**
 * Role-gated route smoke. Covers two surfaces:
 *  - SELLER realm role → /seller/* (seller dashboard, products, etc.)
 *  - ADMIN realm role → /admin/* (admin dashboard, sellers approval, etc.)
 *
 * Uses the seeded `seller1` / `admin1` users from the realm import. Each
 * user logs in via the native form (so the realm_access.roles claim
 * lands in the JWT exactly as it would for a real session) and then
 * navigates to the gated route. The test passes if the URL stays on
 * the gated path — i.e. RequireRole did NOT redirect away.
 */

test.describe("seller routes", () => {
  test("/seller renders for a SELLER user", async ({ page }) => {
    await loginAsPersona(page, "seller");
    await page.goto("/seller");
    // RequireRole sends non-sellers to / — confirming we stay under /seller
    // is sufficient for the smoke. The page itself renders multi-tab navigation.
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toMatch(/^\/seller/);
  });
});

test.describe("admin routes", () => {
  test("/admin renders for an ADMIN user", async ({ page }) => {
    await loginAsPersona(page, "admin");
    await page.goto("/admin");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toMatch(/^\/admin/);
  });

  test("buyer is redirected away from /admin", async ({ page }) => {
    // seller1 has SELLER + BUYER but not ADMIN, so RequireRole bounces.
    await loginAsPersona(page, "seller");
    await page.goto("/admin");
    // Expect to land somewhere other than /admin (RequireRole's fallback is /).
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .not.toMatch(/^\/admin/);
  });
});

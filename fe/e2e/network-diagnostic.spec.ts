import { test, expect } from "@playwright/test";

import { loginAsPersona } from "./_auth";

/**
 * Network diagnostic: walk the main pages logged-in as buyer1 and report
 * every non-2xx response. NOT part of the regular suite (skipped under
 * the {tag: @diagnostic} tag) — run with:
 *   npx playwright test e2e/network-diagnostic.spec.ts --grep @diagnostic
 */
test.describe("network diagnostic", () => {
  test("walk authenticated routes and capture all 4xx/5xx @diagnostic", async ({ page }) => {
    const errors: { method: string; url: string; status: number }[] = [];
    page.on("response", (res) => {
      const status = res.status();
      if (status >= 400) {
        errors.push({ method: res.request().method(), url: res.url(), status });
      }
    });
    page.on("pageerror", (err) => {
      console.error(`PAGE ERROR: ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error(`CONSOLE ERROR: ${msg.text()}`);
      }
    });

    // Use the same browser OIDC path as a real user so route diagnostics cover
    // the deployed session and callback contract.
    await loginAsPersona(page, "buyer");

    // Walk the main routes. The SPA does its own bootstrap on first paint,
    // so we just need to land + wait for network idle on each.
    const routes = [
      "/",
      "/search?q=phone",
      "/cart",
      "/orders",
      "/profile",
      "/wishlist",
      "/messages",
      "/sellers/seller1",
    ];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "networkidle", timeout: 20_000 });
    }

    // Report.
    if (errors.length > 0) {
      console.warn("\n=== non-2xx responses captured ===");
      for (const e of errors) {
        console.warn(`  ${e.status} ${e.method} ${e.url}`);
      }
    } else {
      console.warn("\n=== no non-2xx responses ===");
    }

    // Fail the test only on 5xx — 4xx is often expected (404 on /sellers/seller1
    // if seller1 has no SellerProfile row, 401 from probing pre-cookie, etc.)
    const fivexx = errors.filter((e) => e.status >= 500);
    expect(fivexx, `5xx responses captured: ${JSON.stringify(fivexx, null, 2)}`).toEqual([]);
  });
});

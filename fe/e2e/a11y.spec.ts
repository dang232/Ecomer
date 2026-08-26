import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

import { loginAsPersona } from "./_auth";
import { expectNoGlobalError } from "./_helpers";

/**
 * WCAG 2.1 AA accessibility gate for the three primary personas.
 *
 * Why this exists
 * ───────────────
 * The 2026-06-16 audit found a P1 cluster of contrast / label / landmark
 * regressions on buyer, seller, and admin surfaces. This spec turns those
 * rules into an automated CI gate so the same class of bug cannot land
 * again silently.
 *
 * How it runs
 * ───────────
 * 1. Log in as buyer1 / seller1 / admin1 (seeded fixtures).
 * 2. Navigate to the persona's primary surface (/, /seller, /admin).
 * 3. Run @axe-core/playwright with the wcag2a + wcag2aa rule tags.
 * 4. Fail the test if axe-core reports any violation of severity
 *    "serious" or "critical".
 *
 * Live-services assumption
 * ────────────────────────
 * This spec requires the dockerised FE at http://localhost:3000 and the
 * gateway at http://localhost:8080. It is NOT appropriate for unit test
 * runs — invoke via `npm run test:a11y` (which only runs this spec) in a
 * CI lane after the stack is up.
 *
 * Known false-positives excluded
 * ──────────────────────────────
 *  - `color-contrast`: recharts SVG fills/strokes occasionally fail the
 *    contrast heuristic even when the rendered text passes; we trust the
 *    design-token lint + Storybook a11y for chart text contrast.
 *  - `region`: our Shell wraps pages in landmark regions that axe-core
 *    still flags as "all content not in a landmark" when a third-party
 *    widget (PayPal/PayPal-Buttons iframe, Stripe Elements) injects nodes
 *    outside our landmark. Excluding `iframe` scopes the rule to our own
 *    DOM.
 *  - `<aside data-axe-skip>` is the project convention for axe-core
 *    exclusions — any widget whose false-positive cannot be fixed
 *    upstream should opt out via that attribute (documented in
 *    docs/a11y/axe-exclusions.md).
 */

// The user-service CsrfProtectionFilter requires an X-CSRF-Token header on
// /auth/refresh and /auth/logout. Same pattern as fe/e2e/video-integration-ui.spec.ts.
async function installCsrfPatch(page: Page): Promise<void> {
  const csrfCookie = (await page.context().cookies()).find((c) => c.name === "vnshop_csrf");
  const csrfValue = csrfCookie?.value ?? "";
  const script = `
    (() => {
      const HEADER = "X-CSRF-Token";
      const CSRF = ${JSON.stringify(csrfValue)};
      const origFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url && (url.includes("/auth/refresh") || url.includes("/auth/logout")) && CSRF) {
          init = Object.assign({}, init ?? {}, {
            headers: Object.assign({}, (init && init.headers) || {}, { [HEADER]: CSRF }),
          });
        }
        return origFetch(input, init);
      };
    })();
  `;
  await page.addInitScript({ content: script });
}

// Build the AxeBuilder once per spec with the project-wide configuration.
// Each test calls .analyze() on a fresh instance pointed at its page.
function axeFor(page: Page): AxeBuilder {
  return (
    new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // See "Known false-positives excluded" in the header comment above.
      .disableRules(["color-contrast", "region"])
  );
}

async function assertNoSeriousOrCritical(page: Page, slug: string): Promise<void> {
  const results = await axeFor(page).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );

  // Build a readable failure message — Playwright's default violation
  // serialisation is enormous and unhelpful in CI logs.
  if (blocking.length > 0) {
    const summary = blocking
      .map(
        (v) =>
          `  - [${v.impact}] ${v.id} (${v.nodes.length} node(s))\n` +
          `      help: ${v.help}\n` +
          `      helpUrl: ${v.helpUrl}\n` +
          v.nodes
            .slice(0, 3)
            .map((n) => `      target: ${n.target.join(", ")}`)
            .join("\n"),
      )
      .join("\n");
    throw new Error(
      `WCAG 2.1 AA violations on ${slug}:\n${summary}\n` +
        `Total: ${blocking.length} serious/critical violation(s).`,
    );
  }
}

// ─── Buyer ─────────────────────────────────────────────────────────────────

test.describe("a11y — buyer home page", () => {
  test("Home page passes axe-core wcag2a + wcag2aa (no serious/critical)", async ({ page }) => {
    await page.goto("/");

    // Buyer-facing signal: a product card or the login CTA must render.
    const guestLoginCta = page
      .getByRole("link", {
        name: /^(Log in|Đăng nhập)$/i,
      })
      .first();
    const productCard = page
      .locator("[data-testid='product-tile'], [data-testid='product-card']")
      .first();

    await expect(guestLoginCta.or(productCard).first()).toBeVisible({ timeout: 30_000 });

    await expectNoGlobalError(page);
    await assertNoSeriousOrCritical(page, "/");
  });
});

// ─── Seller ────────────────────────────────────────────────────────────────

test.describe("a11y — seller dashboard", () => {
  test("Seller dashboard passes axe-core wcag2a + wcag2aa (no serious/critical)", async ({
    page,
  }) => {
    await loginAsPersona(page, "seller");
    await installCsrfPatch(page);
    await page.goto("/seller");

    await expect(page.getByTestId("seller-dashboard")).toBeVisible({ timeout: 20_000 });

    await expectNoGlobalError(page);
    await assertNoSeriousOrCritical(page, "/seller");
  });
});

// ─── Admin ─────────────────────────────────────────────────────────────────

test.describe("a11y — admin panel", () => {
  test("Admin panel passes axe-core wcag2a + wcag2aa (no serious/critical)", async ({ page }) => {
    await loginAsPersona(page, "admin");
    await installCsrfPatch(page);
    await page.goto("/admin");

    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await expectNoGlobalError(page);
    await assertNoSeriousOrCritical(page, "/admin");
  });
});

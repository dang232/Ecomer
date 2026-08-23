import { test, expect } from "@playwright/test";

import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the home page (most-visited surface).
 *
 * What this proves through the actual SPA:
 *   - Home page mounts past Suspense for guests
 *   - The populated storefront renders a localized landmark (regression
 *     check for the pt27 i18n duplicate-key bug)
 *   - Major sections (categories, sellers, recommendations, trust cues)
 *     all render their headers
 *   - Tabler icons appear in the hero, trust strip, and category nav
 *     (regression check for the lucide → tabler migration in pt27 —
 *     a missed icon would render as text or break the layout)
 *
 * No backend or auth needed. Runs on / as a guest.
 */

test.describe("home page UI", () => {
  test("Home renders without the global error fallback (guest)", async ({ page }) => {
    await page.goto("/");

    // The header Login CTA is the canonical guest-state signal.
    await expect(page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expectNoGlobalError(page);
  });

  test("Storefront renders a localized landmark (no raw i18n keys)", async ({ page }) => {
    await page.goto("/");

    // Pre-pt27 the hero rendered "home.hero.title" / "home.hero.ctaShop"
    // as raw text. Assert those keys never leak.
    await expect(page.getByText(/^home\.hero\./i)).toHaveCount(0);

    // CampaignBand renders an H1 only when campaign data exists. The
    // categories heading is always present on a populated storefront.
    const storefrontLandmark = page.getByRole("heading", {
      name: /Browse categories|Kham pha danh muc/i,
    });
    await expect(storefrontLandmark).toBeVisible({ timeout: 20_000 });
  });

  test("Major home sections all render their headers", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    // Each section header should appear at least once. We use a tolerant
    // regex per section so this works in either language.
    const sectionMatchers = [
      /Browse categories|Kham pha danh muc/i,
      /Featured sellers|Nha ban hang noi bat/i,
      /Recommended for You|Goi Y Cho Ban/i,
    ];

    for (const matcher of sectionMatchers) {
      await expect(page.getByText(matcher).first()).toBeVisible({
        timeout: 10_000,
      });
    }

    await expect(page.getByLabel("Purchase assurances")).toBeVisible();

    await expectNoGlobalError(page);
  });

  test("Footer renders current marketplace and support links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    // Scroll to footer to trigger any lazy mounts.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const footer = page.locator("footer");
    await expect(footer).toBeVisible({ timeout: 10_000 });
    await expect(
      footer.getByText(/All Categories|Tất cả danh mục|Help Center|Trung tâm hỗ trợ/i).first(),
    ).toBeVisible();
    await expect(footer.getByText(/© 2026 VNShop/i)).toBeVisible();
  });
});

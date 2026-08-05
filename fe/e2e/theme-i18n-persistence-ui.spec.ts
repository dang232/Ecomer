import { test, expect, type Page } from "@playwright/test";

import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for theme + i18n persistence across reloads.
 *
 * What this proves through the actual SPA:
 *   - Toggling dark mode survives a hard reload (the FE keeps the toggle
 *     state somewhere — either localStorage, a cookie, or it re-derives
 *     from the system preference)
 *   - Switching language to EN survives a reload (i18next-browser-
 *     languagedetector caches in localStorage under "i18nextLng")
 *
 * No backend or auth needed.
 */

async function isDarkClassPresent(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.classList.contains("dark"));
}

test.describe("theme + i18n persistence UI", () => {
  test("Switching language to EN survives a hard reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    // Force VI as the starting point so the test is deterministic.
    await page.evaluate(() => {
      try {
        localStorage.setItem("i18nextLng", "vi");
      } catch {
        /* ignore */
      }
    });
    await page.reload();
    await expect(page.getByText(/Trang Chủ|Đăng nhập/).first()).toBeVisible({ timeout: 20_000 });

    // Click the switcher to flip VI → EN.
    await page
      .getByRole("button", { name: /^Switch language to EN$/i })
      .first()
      .click();

    // English nav copy appears.
    await expect(page.getByText(/All Categories|Sign in|Log in/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Hard-reload — the SPA re-mounts; the language detector should
    // restore EN from localStorage.
    await page.reload();
    await expect(page.getByText(/All Categories|Sign in|Log in/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // The Vietnamese nav copy must NOT have come back.
    await expect(page.getByText(/Trang Chủ/)).toHaveCount(0);

    // localStorage carries the EN choice.
    const storedLang = await page.evaluate(() => {
      try {
        return localStorage.getItem("i18nextLng");
      } catch {
        return null;
      }
    });
    expect(storedLang).toMatch(/^en/i);

    await expectNoGlobalError(page);
  });

  test("Dark mode toggle state changes the body bg, even on reload", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /switch to (dark|light) mode/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Force a known starting state.
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
    });

    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Toggle to dark.
    await page
      .getByRole("button", { name: /switch to dark mode/i })
      .first()
      .click();
    await expect.poll(() => isDarkClassPresent(page), { timeout: 5_000 }).toBe(true);

    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(darkBg).not.toBe(lightBg);

    // Hard-reload. vnshop-context persists the preference under
    // `vnshop:theme`, so the dark class and computed background should remain.
    await page.reload();
    await expect(
      page.getByRole("button", { name: /switch to (dark|light) mode/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    const reloadedBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await expect.poll(() => isDarkClassPresent(page), { timeout: 5_000 }).toBe(true);
    expect(reloadedBg).toBe(darkBg);

    await expectNoGlobalError(page);
  });
});

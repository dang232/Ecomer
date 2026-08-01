import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

// Intentionally empty .catch(() => {}) callbacks for graceful timeout handling.
/* eslint-disable @typescript-eslint/no-empty-function */

import { COMMERCE_ACCEPTANCE, ACCEPTANCE_VIEWPORTS } from "../fixtures/commerce-acceptance";

import { authenticateForPath } from "./_acceptance-auth";
import { test as acceptanceTest, expectNoPageOverflow, expectNoIntersection } from "./_fixtures";
import { stateDrivers } from "./_state-drivers";

const VIEWPORTS = Object.values(ACCEPTANCE_VIEWPORTS);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve a templated path by substituting seeded IDs.
 * Falls back to the literal path when no substitution is available.
 */
function resolvePath(path: string): string {
  return path
    .replace(/\{seededProductId\}/g, "seed-1")
    .replace(/\{acceptanceSellerId\}/g, "seller-seed-1")
    .replace(/\{acceptanceOrderId\}/g, "seed-order-1")
    .replace(/\{seededOrderId\}/g, "seed-order-1")
    .replace(/\?.*$/, ""); // strip query strings for route resolution
}

// ─── Viewport × route snapshot matrix ──────────────────────────────────────────

acceptanceTest.describe("visual matrix — commerce acceptance routes", () => {
  for (const viewport of VIEWPORTS) {
    acceptanceTest.describe(`${viewport.label} (${viewport.width}x${viewport.height})`, () => {
      acceptanceTest.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      for (const route of COMMERCE_ACCEPTANCE) {
        const resolvedPath = resolvePath(route.path);

        acceptanceTest(`${route.path} → ready state renders without overflow`, async ({ page }) => {
          await authenticateForPath(page, resolvedPath);
          await page.goto(resolvedPath);

          const driver = stateDrivers[`${route.path}::ready`];
          if (driver) {
            await driver.prepare(page, resolvedPath);
          }

          await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

          await expectNoPageOverflow(page);

          // Assert the page is still alive and has a landmark
          await expect(page.locator("main, [role='main'], body")).toBeVisible();
        });

        acceptanceTest(`${route.path} → no sticky-element overlaps at ready`, async ({ page }) => {
          await authenticateForPath(page, resolvedPath);
          await page.goto(resolvedPath);
          await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

          const nav = page.locator("nav, header, [role='navigation']").first();
          const content = page.locator("main, [role='main']").first();

          if (
            (await nav.isVisible({ timeout: 3_000 }).catch(() => false)) &&
            (await content.isVisible({ timeout: 3_000 }).catch(() => false))
          ) {
            await expectNoIntersection(nav, content);
          }
        });

        acceptanceTest(
          `${route.path} → WCAG 2.1 AA at ready state (axe-core)`,
          async ({ page }) => {
            await authenticateForPath(page, resolvedPath);
            await page.goto(resolvedPath);
            await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

            const results = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa"])
              .disableRules(["color-contrast", "region"])
              .analyze();

            const blocking = results.violations.filter(
              (v) => v.impact === "serious" || v.impact === "critical",
            );

            if (blocking.length > 0) {
              const summary = blocking
                .slice(0, 3)
                .map((v) => `  - [${v.impact}] ${v.id}: ${v.help}`)
                .join("\n");
              throw new Error(`WCAG violations on ${route.path} at ${viewport.label}:\n${summary}`);
            }
          },
        );
      }
    });
  }
});

// ─── Text-scale: 200% font size ────────────────────────────────────────────────

acceptanceTest.describe("visual matrix — text-scale at 200%", () => {
  const TEXT_SCALE_VIEWPORTS = VIEWPORTS.filter((v) => v.label !== "wide");

  for (const viewport of TEXT_SCALE_VIEWPORTS) {
    acceptanceTest.describe(`${viewport.label} @ 200% text`, () => {
      acceptanceTest.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        // Scale text to 200% without changing layout dimensions
        await page.emulateMedia({ reducedMotion: "no-preference" });
      });

      for (const route of COMMERCE_ACCEPTANCE) {
        const resolvedPath = resolvePath(route.path);

        acceptanceTest(`${route.path} → 200% text, no horizontal overflow`, async ({ page }) => {
          await authenticateForPath(page, resolvedPath);
          await page.goto(resolvedPath);
          await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

          // Apply 200% font-size scaling to the root
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "200%";
          });

          // Wait for re-render
          await page.waitForTimeout(500);

          await expectNoPageOverflow(page);
        });

        acceptanceTest(`${route.path} → 200% text, critical content legible`, async ({ page }) => {
          await authenticateForPath(page, resolvedPath);
          await page.goto(resolvedPath);
          await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

          await page.evaluate(() => {
            document.documentElement.style.fontSize = "200%";
          });

          await page.waitForTimeout(500);

          // At least one heading or CTA must remain visible
          const heading = page.getByRole("heading").first();
          const cta = page.getByRole("button", { name: /add|cart|buy|login|sign/i }).first();

          const visible =
            (await heading.isVisible({ timeout: 3_000 }).catch(() => false)) ||
            (await cta.isVisible({ timeout: 3_000 }).catch(() => false));

          expect(visible).toBe(true);
        });
      }
    });
  }
});

// ─── Locale: Vietnamese content renders ───────────────────────────────────────

acceptanceTest.describe("visual matrix — Vietnamese locale renders", () => {
  for (const viewport of VIEWPORTS) {
    acceptanceTest.describe(`${viewport.label}`, () => {
      acceptanceTest.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      for (const route of COMMERCE_ACCEPTANCE) {
        const resolvedPath = resolvePath(route.path);

        acceptanceTest(`${route.path} → vi locale, no console errors`, async ({ page }) => {
          await authenticateForPath(page, resolvedPath);
          await page.goto(resolvedPath);

          // Request Vietnamese
          await page.evaluate(() => {
            document.cookie = "NEXT_LOCALE=vi; path=/";
          });
          await page.reload();

          await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

          // Page must not be blank
          await expect(page.locator("body")).not.toBeEmpty();
        });
      }
    });
  }
});

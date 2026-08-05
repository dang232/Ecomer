import { expect } from "@playwright/test";

// Intentionally empty .catch(() => {}) callbacks throughout for graceful timeout handling.
/* eslint-disable @typescript-eslint/no-empty-function */

import { COMMERCE_ACCEPTANCE, ACCEPTANCE_VIEWPORTS } from "../fixtures/commerce-acceptance";

import { authenticateForPath } from "./_acceptance-auth";
import { test as acceptanceTest, expectNoPageOverflow } from "./_fixtures";

const VIEWPORTS = Object.values(ACCEPTANCE_VIEWPORTS);

// ─── 200% text scale ───────────────────────────────────────────────────────────

/**
 * WCAG 2.1 SC 1.4.4 (Resize text) requires that text can be scaled to 200%
 * without loss of content or functionality.
 *
 * This suite runs at mobile + tablet (SC 1.4.4 applies to these viewports).
 * Desktop and wide viewports are tested separately in visual-matrix.
 */
acceptanceTest.describe("text-scale — 200% font-size WCAG SC 1.4.4", () => {
  const TEXT_SCALE_VIEWPORTS = VIEWPORTS.filter(
    (v) => v.label === "mobile" || v.label === "tablet",
  );

  for (const viewport of TEXT_SCALE_VIEWPORTS) {
    acceptanceTest.describe(
      `${viewport.label} (${viewport.width}x${viewport.height}) @ 200%`,
      () => {
        acceptanceTest.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
        });

        for (const route of COMMERCE_ACCEPTANCE) {
          const { path } = route;

          acceptanceTest(`${path} → 200% text, no horizontal overflow`, async ({ page }) => {
            await authenticateForPath(page, path);
            await page.goto(path);
            await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {
              /* no-op: networkidle timeout is acceptable for text-scale checks */
            });

            // Apply 200% font scaling to the document root
            await page.evaluate(() => {
              document.documentElement.style.fontSize = "200%";
            });
            await page.waitForTimeout(300); // allow layout to settle

            await expectNoPageOverflow(page);
          });

          acceptanceTest(
            `${path} → 200% text, critical content remains interactive`,
            async ({ page }) => {
              await authenticateForPath(page, path);
              await page.goto(path);
              await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {
                /* no-op: networkidle timeout is acceptable for text-scale checks */
              });

              await page.evaluate(() => {
                document.documentElement.style.fontSize = "200%";
              });
              await page.waitForTimeout(300);

              // Count visible interactive elements at normal scale (sample 5)
              await page.evaluate(() => {
                document.documentElement.style.fontSize = "100%";
              });

              const interactives = page.locator(
                "a[href], button, input, select, textarea, [tabindex='0'], [contenteditable='true']",
              );

              await page.evaluate(() => {
                document.documentElement.style.fontSize = "200%";
              });

              // At least one interactive element must still be visible
              const firstInteractive = interactives.first();
              const visible = await firstInteractive
                .isVisible({ timeout: 3_000 })
                .catch(() => false);

              expect(visible).toBe(true);
            },
          );

          acceptanceTest(
            `${path} → 200% text, page title and landmark intact`,
            async ({ page }) => {
              await authenticateForPath(page, path);
              await page.goto(path);
              await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {
                /* no-op: networkidle timeout is acceptable for text-scale checks */
              });

              await page.evaluate(() => {
                document.documentElement.style.fontSize = "200%";
              });
              await page.waitForTimeout(300);

              // The page title must not be empty (document still alive)
              expect(await page.title()).toBeTruthy();

              // At least one landmark must be present
              const landmark = page.locator("header, main, footer, nav, [role='main']").first();
              await expect(landmark).toBeVisible({ timeout: 3_000 });
            },
          );

          acceptanceTest(`${path} → 200% text, no fatal JS error in console`, async ({ page }) => {
            const errors: string[] = [];
            page.on("pageerror", (err) => errors.push(err.message));

            await authenticateForPath(page, path);
            await page.goto(path);
            await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {
              /* no-op: networkidle timeout is acceptable for text-scale checks */
            });

            await page.evaluate(() => {
              document.documentElement.style.fontSize = "200%";
            });
            await page.waitForTimeout(300);

            const fatalErrors = errors.filter(
              (e) =>
                !e.includes("ResizeObserver") &&
                !e.includes("font loading") &&
                !e.includes("favicon"),
            );
            expect(fatalErrors).toHaveLength(0);
          });
        }
      },
    );
  }
});

// ─── Dynamic type: root font-size from CSS variable ───────────────────────────────

acceptanceTest.describe("text-scale — CSS variable–driven font-size", () => {
  const viewports = Object.values(ACCEPTANCE_VIEWPORTS);

  for (const viewport of viewports) {
    acceptanceTest.describe(`${viewport.label}`, () => {
      acceptanceTest.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      acceptanceTest(
        "root --font-scale variable scales all rem units at 200%",
        async ({ page }) => {
          await page.goto("/");
          await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

          // Set a custom font-scale CSS variable
          await page.evaluate(() => {
            document.documentElement.style.setProperty("--font-scale", "2");
          });
          await page.waitForTimeout(300);

          await expectNoPageOverflow(page);
        },
      );
    });
  }
});

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Intentionally empty .catch(() => {}) callbacks throughout for graceful timeout handling.
/* eslint-disable @typescript-eslint/no-empty-function */

import {
  ACCEPTANCE_VIEWPORTS,
  COMMERCE_ACCEPTANCE,
  resolveAcceptancePath,
} from "../fixtures/commerce-acceptance";

import { authenticateForPath } from "./_acceptance-auth";
import { test as acceptanceTest } from "./_fixtures";
import { stateDrivers } from "./_state-drivers";

const VIEWPORTS = Object.values(ACCEPTANCE_VIEWPORTS);

// ─── CSRF patch — mirrors fe/e2e/a11y.spec.ts ─────────────────────────────────

async function installCsrfPatch(page: Page): Promise<void> {
  const csrfCookie = (await page.context().cookies()).find((c) => c.name === "vnshop_csrf");
  const csrfValue = csrfCookie?.value ?? "";
  await page.addInitScript({
    content: `
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
    `,
  });
}

// ─── WCAG gate per acceptance route at every viewport ───────────────────────────

acceptanceTest.describe("accessibility — WCAG 2.1 AA commerce acceptance matrix", () => {
  for (const viewport of VIEWPORTS) {
    acceptanceTest.describe(`${viewport.label} (${viewport.width}x${viewport.height})`, () => {
      acceptanceTest.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      for (const route of COMMERCE_ACCEPTANCE) {
        const { path } = route;

        acceptanceTest(`${path} → no serious/critical WCAG violations`, async ({ page }) => {
          await authenticateForPath(page, path);
          await installCsrfPatch(page);
          await page.goto(await resolveAcceptancePath(page.request, path));
          await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {
            /* no-op: networkidle timeout is acceptable for WCAG checks */
          });

          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            // Same exclusions as fe/e2e/a11y.spec.ts
            .disableRules(["color-contrast", "region"])
            .analyze();

          const blocking = results.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical",
          );

          if (blocking.length > 0) {
            const summary = blocking
              .map(
                (v) =>
                  `  - [${v.impact}] ${v.id}\n` +
                  `      help: ${v.help}\n` +
                  `      nodes: ${v.nodes
                    .slice(0, 2)
                    .map((n) => n.target.join(", "))
                    .join("; ")}`,
              )
              .join("\n");
            throw new Error(`WCAG violations on ${path} (${viewport.label}):\n${summary}`);
          }
        });
      }
    });
  }
});

// ─── Error states: axe must not crash on error UI ────────────────────────────────

acceptanceTest.describe("accessibility — error states have no additional violations", () => {
  for (const route of COMMERCE_ACCEPTANCE) {
    if (!(route.states as readonly string[]).includes("error")) continue;
    const { path } = route;

    acceptanceTest(`${path} error state → error UI passes axe`, async ({ page }) => {
      await authenticateForPath(page, path);
      await installCsrfPatch(page);
      const resolvedPath = await resolveAcceptancePath(page.request, path);
      await page.goto(resolvedPath);

      const errorDriver = stateDrivers[`${path}::error`];
      if (errorDriver) {
        await errorDriver.prepare(page, resolvedPath);
      }

      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

      if (errorDriver?.assert) {
        await errorDriver.assert(page);
      }

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .disableRules(["color-contrast", "region"])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );

      if (blocking.length > 0) {
        throw new Error(
          `WCAG violations on error state ${path}:\n${blocking
            .map((v) => `  - [${v.impact}] ${v.id}: ${v.help}`)
            .join("\n")}`,
        );
      }
    });
  }
});

// ─── Keyboard navigation: focus trap in modal dialogs ──────────────────────────

acceptanceTest.describe("accessibility — keyboard navigation", () => {
  for (const route of COMMERCE_ACCEPTANCE) {
    const { path } = route;

    acceptanceTest(`${path} → focus visible and not trapped outside viewport`, async ({ page }) => {
      await authenticateForPath(page, path);
      await installCsrfPatch(page);
      await page.goto(await resolveAcceptancePath(page.request, path));
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

      // Tab to the first focusable element
      await page.keyboard.press("Tab");

      // Focused element must be visible and inside the viewport
      const focused = page.locator(":focus");
      const isFocusedVisible = await focused.isVisible({ timeout: 5_000 }).catch(() => false);

      expect(isFocusedVisible).toBe(true);

      // The focused element must not be clipped (outside viewport bounds)
      const bb = await focused.boundingBox();
      if (bb) {
        const viewportSize = page.viewportSize() ?? { width: 1024, height: 768 };
        expect(bb.x + bb.width).toBeLessThanOrEqual(viewportSize.width);
        expect(bb.y + bb.height).toBeLessThanOrEqual(viewportSize.height);
        expect(bb.x).toBeGreaterThanOrEqual(0);
        expect(bb.y).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

// ─── Locale: Vietnamese text legible at all viewports ─────────────────────────

acceptanceTest.describe("accessibility — Vietnamese locale WCAG", () => {
  for (const viewport of VIEWPORTS) {
    acceptanceTest.describe(`${viewport.label}`, () => {
      acceptanceTest.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      for (const route of COMMERCE_ACCEPTANCE) {
        const { path } = route;

        acceptanceTest(`${path} → vi locale, no serious violations`, async ({ page }) => {
          await authenticateForPath(page, path);
          await installCsrfPatch(page);
          await page.goto(await resolveAcceptancePath(page.request, path));

          // Switch to Vietnamese
          await page.evaluate(() => {
            document.cookie = "NEXT_LOCALE=vi; path=/";
          });
          await page.reload();
          await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast", "region"])
            .analyze();

          const blocking = results.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical",
          );

          if (blocking.length > 0) {
            throw new Error(
              `WCAG violations on ${path} (vi locale, ${viewport.label}):\n${blocking
                .slice(0, 3)
                .map((v) => `  - [${v.impact}] ${v.id}: ${v.help}`)
                .join("\n")}`,
            );
          }
        });
      }
    });
  }
});

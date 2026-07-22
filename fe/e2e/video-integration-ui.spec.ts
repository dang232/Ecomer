import { test, expect, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectNoGlobalError } from "./_helpers";
import { loginViaOidc } from "./_auth";

/**
 * E2E spec for Video FE Integration — proves the video UI wiring renders
 * without crashing through the real SPA.
 *
 * Login via UI form (httpOnly cookie auth requires same-origin).
 */

const screenshotDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "evidence",
  "video-integration",
  "screenshots",
);

let screenshotIdx = 0;

async function screenshot(page: Page, slug: string) {
  screenshotIdx++;
  const filename = `${String(screenshotIdx).padStart(2, "0")}-${slug}.png`;
  await fs.mkdir(screenshotDir, { recursive: true });
  const outputPath = path.join(screenshotDir, filename);
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.screenshot({ path: outputPath, fullPage: false });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function loginViaUI(page: Page, username: string) {
  await loginViaOidc(page, username);
}

// ─── Admin: Video Moderation tab renders ───────────────────────────────────

test.describe("video integration — admin", () => {
  test("Admin page loads and Video Moderation nav item is visible", async ({ page }) => {
    await loginViaUI(page, "admin1");
    await page.goto("/admin");

    // Confirm admin page loaded
    await expect(page.getByText(/Admin Dashboard|Tổng quan|Admin Console/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await screenshot(page, "admin-dashboard-loaded");

    // Video Moderation nav item should be visible in sidebar
    const videoModNav = page.getByText(/Video Moderation|Kiểm duyệt Video/i).first();
    await expect(videoModNav).toBeVisible({ timeout: 10_000 });

    await screenshot(page, "admin-video-moderation-nav-visible");

    // Click it
    await videoModNav.click();

    // Verify the panel renders (look for sub-tab text)
    await expect(page.getByText(/Video Appeals|Kháng cáo Video/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await screenshot(page, "admin-video-moderation-panel-rendered");
    await expectNoGlobalError(page);
  });
});

// ─── Seller: Videos section in product modal ───────────────────────────────

test.describe("video integration — seller", () => {
  test("Seller dashboard loads and product modal has Videos section", async ({ page }) => {
    await loginViaUI(page, "seller1");
    await page.goto("/seller");

    // Wait for seller page to render
    await expect(page.getByText(/Dashboard|Tổng quan|Seller|Cửa hàng/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await screenshot(page, "seller-dashboard-loaded");

    // Look for Products tab/section
    const productsNav = page.getByText(/Products|Sản phẩm/i).first();
    await expect(productsNav).toBeVisible({ timeout: 10_000 });
    await productsNav.click();

    // Look for Add Product button
    const addBtn = page.getByText(/Add product|Thêm sản phẩm/i).first();
    await expect(addBtn).toBeVisible({ timeout: 15_000 });

    await screenshot(page, "seller-products-tab");
    await addBtn.click();

    // Modal should open — look for Videos section label (English, Vietnamese, or raw i18n key)
    await expect(
      page.getByText(/Videos? \(0\/3\)|Video \(0\/3\)|videosLabel|videoLabel/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await screenshot(page, "seller-modal-videos-section");
    await expectNoGlobalError(page);
  });
});

// ─── Buyer: Product page gallery renders ───────────────────────────────────

test.describe("video integration — buyer", () => {
  test("Home page loads and product gallery renders on product page", async ({ page }) => {
    await page.goto("/");

    // Wait for the SPA shell + product cards to render
    await expect(page.locator("[data-testid='product-card']").first()).toBeVisible({
      timeout: 30_000,
    });

    await screenshot(page, "homepage-loaded");

    // Click the first product card (the FE uses onClick navigation, not href)
    const productLink = page.locator("[data-testid='product-card']").first();
    const hasProducts = await productLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasProducts) {
      await productLink.click();

      // Gallery region should render
      await expect(page.locator("[aria-label='Product media gallery']").first()).toBeVisible({
        timeout: 15_000,
      });

      await screenshot(page, "product-page-gallery-rendered");
      await expectNoGlobalError(page);
      await screenshot(page, "product-page-no-error");
    } else {
      // No products seeded — just confirm homepage didn't crash
      await expectNoGlobalError(page);
      await screenshot(page, "homepage-no-products-no-error");
    }
  });
});

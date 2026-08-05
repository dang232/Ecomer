import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { loginAsPersona } from "./_auth";
import type { Persona } from "./modernization/_credentials";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIR = join(__dirname, "evidence", "audit");

async function snap(page: Page, name: string, full = true) {
  await mkdir(DIR, { recursive: true });
  const outputPath = join(DIR, `${name}.png`);
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.screenshot({ path: outputPath, fullPage: full });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function loginAs(page: Page, persona: Persona) {
  await loginAsPersona(page, persona);
}

// ─── GUEST FLOWS ──────────────────────────────────────────────────
test("08 — Login: wrong credentials error UX", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#username").fill("fake@test.com");
  await page.locator("#password").fill("wrongpassword");
  await page.getByRole("button", { name: /sign in|continue to sign in/i }).click();
  await page.waitForTimeout(1000);
  await snap(page, "08-login-wrong-credentials", false);
});

test("09 — Register page", async ({ page }) => {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await snap(page, "09-register-page");
});

test("10 — Register: empty submit validation", async ({ page }) => {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  const btn = page.locator('button[type="submit"]');
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(1000);
    await snap(page, "10-register-empty-validation");
  }
});

test("11 — Search page (no query)", async ({ page }) => {
  await page.goto("/search");
  await page.waitForLoadState("networkidle");
  await snap(page, "11-search-page-empty");
});

test("12 — Search results (iphone)", async ({ page }) => {
  await page.goto("/search?q=iphone");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await snap(page, "12-search-results-iphone");
});

test("13 — Guest → Cart (redirect check)", async ({ page }) => {
  await page.goto("/cart");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await snap(page, "13-guest-cart-access");
});

test("14 — Guest → Checkout (redirect check)", async ({ page }) => {
  await page.goto("/checkout");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await snap(page, "14-guest-checkout-access");
});

test("15 — 404 page", async ({ page }) => {
  await page.goto("/this-does-not-exist-xyz");
  await page.waitForLoadState("networkidle");
  await snap(page, "15-404-page");
});

test("16 — Dark mode toggle", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Find the theme toggle in the navbar
  const themeBtn = page.locator(
    'button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="Theme"]',
  );
  if (await themeBtn.first().isVisible()) {
    await themeBtn.first().click();
    await page.waitForTimeout(500);
  } else {
    // Try the moon/sun icon button in the top bar
    const moonBtn = page.locator("nav button").nth(2);
    if (await moonBtn.isVisible()) await moonBtn.click();
    await page.waitForTimeout(500);
  }
  await snap(page, "16-dark-mode-homepage", false);
});

test("17 — Language switch", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const langBtn = page.locator(
    'button:has-text("EN"), button:has-text("VI"), button:has-text("English"), button:has-text("Tiếng Việt")',
  );
  if (await langBtn.first().isVisible()) {
    await langBtn.first().click();
    await page.waitForTimeout(1000);
    await snap(page, "17-language-switched", false);
  } else {
    await snap(page, "17-no-language-switch-found", false);
  }
});

test("18 — Password Reset page", async ({ page }) => {
  await page.goto("/password-reset");
  await page.waitForLoadState("networkidle");
  await snap(page, "18-password-reset-page");
});

// ─── BUYER FLOWS ──────────────────────────────────────────────────
test("19 — Buyer: logged-in homepage", async ({ page }) => {
  await loginAs(page, "buyer");
  await snap(page, "19-buyer-logged-in-home", false);
});

test("20 — Buyer: Cart page", async ({ page }) => {
  await loginAs(page, "buyer");
  await page.goto("/cart");
  await page.waitForLoadState("networkidle");
  await snap(page, "20-buyer-cart-page");
});

test("21 — Buyer: Profile page", async ({ page }) => {
  await loginAs(page, "buyer");
  await page.goto("/profile");
  await page.waitForLoadState("networkidle");
  await snap(page, "21-buyer-profile-page");
});

test("22 — Buyer: Wishlist", async ({ page }) => {
  await loginAs(page, "buyer");
  await page.goto("/wishlist");
  await page.waitForLoadState("networkidle");
  await snap(page, "22-buyer-wishlist-page");
});

test("23 — Buyer: Orders", async ({ page }) => {
  await loginAs(page, "buyer");
  await page.goto("/orders");
  await page.waitForLoadState("networkidle");
  await snap(page, "23-buyer-orders-page");
});

test("24 — Buyer: Notifications", async ({ page }) => {
  await loginAs(page, "buyer");
  await page.goto("/notifications");
  await page.waitForLoadState("networkidle");
  await snap(page, "24-buyer-notifications-page");
});

test("25 — Buyer: Messages", async ({ page }) => {
  await loginAs(page, "buyer");
  await page.goto("/messages");
  await page.waitForLoadState("networkidle");
  await snap(page, "25-buyer-messages-page");
});

test("26 — Buyer: Add to cart from product detail", async ({ page }) => {
  await loginAs(page, "buyer");
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const link = page.locator('a[href*="/product/"]').first();
  if (await link.isVisible()) {
    await link.click();
    await page.waitForLoadState("networkidle");
    const btn = page
      .locator(
        'button:has-text("Add to cart"), button:has-text("Thêm vào giỏ"), button:has-text("add to cart")',
      )
      .first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(2000);
    }
    await snap(page, "26-buyer-add-to-cart-result", false);
  }
});

test("27 — Buyer: Checkout page", async ({ page }) => {
  await loginAs(page, "buyer");
  await page.goto("/checkout");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await snap(page, "27-buyer-checkout-page");
});

// ─── SELLER FLOWS ─────────────────────────────────────────────────
test("28 — Seller: Dashboard", async ({ page }) => {
  await loginAs(page, "seller");
  await page.goto("/seller");
  await page.waitForLoadState("networkidle");
  await snap(page, "28-seller-dashboard");
});

test("29 — Seller: Products tab", async ({ page }) => {
  await loginAs(page, "seller");
  await page.goto("/seller");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Products$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "29-seller-products-tab");
});

test("30 — Seller: Orders tab", async ({ page }) => {
  await loginAs(page, "seller");
  await page.goto("/seller");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Orders$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "30-seller-orders-tab");
});

test("31 — Seller: Reviews tab", async ({ page }) => {
  await loginAs(page, "seller");
  await page.goto("/seller");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Reviews$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "31-seller-reviews-tab");
});

test("32 — Seller: Wallet tab", async ({ page }) => {
  await loginAs(page, "seller");
  await page.goto("/seller");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Wallet$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "32-seller-wallet-tab");
});

test("33 — Seller: Settings tab", async ({ page }) => {
  await loginAs(page, "seller");
  await page.goto("/seller");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Settings$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "33-seller-settings-tab");
});

// ─── ADMIN FLOWS ──────────────────────────────────────────────────
test("34 — Admin: Dashboard", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await snap(page, "34-admin-dashboard");
});

test("35 — Admin: Approve Sellers", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Approve Sellers/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "35-admin-approve-sellers");
});

test("36 — Admin: Moderation", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Moderation(?:,|$)/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "36-admin-moderation");
});

test("37 — Admin: Coupons", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Coupons$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "37-admin-coupons");
});

test("38 — Admin: Disputes", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Disputes$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "38-admin-disputes");
});

test("39 — Admin: Payouts", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Payouts$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "39-admin-payouts");
});

test("40 — Admin: Users tab", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Users$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "40-admin-users-tab");
});

test("41 — Admin: Orders tab", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Orders$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "41-admin-orders-tab");
});

test("42 — Admin: Health tab", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^System Health$/i }).click();
  await page.waitForTimeout(2000);
  await snap(page, "42-admin-health-tab");
});

// ─── MISC ─────────────────────────────────────────────────────────
test("43 — Sellers public listing", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Try "View all" in Top Sellers section or /sellers link
  const viewAll = page.locator('a:has-text("View all")').last();
  if (await viewAll.isVisible()) {
    await viewAll.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "43-sellers-public-listing");
  } else {
    await snap(page, "43-homepage-sellers-section", false);
  }
});

test("44 — Mobile: Homepage (375px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await snap(page, "44-mobile-homepage");
});

test("45 — Mobile: Login (375px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await snap(page, "45-mobile-login");
});

test("46 — Mobile: Product Detail (375px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const link = page.locator('a[href*="/product/"]').first();
  if (await link.isVisible()) {
    await link.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "46-mobile-product-detail");
  }
});

test("47 — Product Detail page (desktop, full)", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const link = page.locator('a[href*="/product/"]').first();
  if (await link.isVisible()) {
    await link.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "47-product-detail-desktop-full");
  }
});

test("48 — Guest add-to-cart blocked toast", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const link = page.locator('a[href*="/product/"]').first();
  if (await link.isVisible()) {
    await link.click();
    await page.waitForLoadState("networkidle");
    const btn = page
      .locator(
        'button:has-text("Add to cart"), button:has-text("Thêm vào giỏ"), button:has-text("add to cart")',
      )
      .first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
    await snap(page, "48-guest-add-to-cart-blocked", false);
  }
});

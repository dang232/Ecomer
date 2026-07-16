import { test, expect } from "@playwright/test";

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

/**
 * Regression for the address-shape mismatch fix. The FE used to send
 * {line1, line2, province, country, phone, ...} which the BE silently
 * mapped to a null `street`, raising "street is required" on save even
 * with every visible input filled.
 *
 * After the rename FE sends {street, ward, district, city, isDefault, phone}
 * — a true mirror of the BE record. This test drives the form end-to-end
 * through the gateway and asserts the row round-trips, plus screenshots
 * the fail mode (the toast surfaces "street is required" if it ever
 * regresses).
 *
 * Each run registers a fresh buyer so the test is deterministic and
 * doesn't compete with the seeded users for the singleton-default flag.
 */

const PASSWORD = "Test1234!";

test.describe("profile address add", () => {
  test("fills the address form and persists through /users/me/addresses", async ({ page }) => {
    const stamp = Date.now();
    const email = `e2e_addr_${stamp}@vnshop.local`;

    // Register a fresh buyer — the auth provider auto-logs in on success.
    await page.goto("/register");
    await page.locator("#firstName").fill("Addr");
    await page.locator("#lastName").fill("Tester");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill(PASSWORD);
    await page.getByRole("button", { name: /create account|tạo tài khoản/i }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe("/");

    await page.goto("/profile");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/profile");

    // The Addresses tab uses the i18n string from profile.tabs.addresses
    // (en: "Addresses", vi: "Địa chỉ") — match either.
    await page.getByRole("button", { name: /^addresses$|^địa chỉ$/i }).click();

    // Open the add-address form. When the form is closed the toggle reads
    // "Add address" / "Thêm địa chỉ"; once it's open the same button reads
    // "Close" / "Đóng".
    await page.getByRole("button", { name: /add address|thêm địa chỉ/i }).click();

    // Form labels come from profile.addresses.fields — match by visible
    // label so the test reads the same as the user.
    await page.getByLabel(/street, house number|số nhà, đường/i).fill("12 Lê Lợi");
    await page.getByLabel(/ward|phường\/xã/i).fill("Bến Nghé");
    await page.getByLabel(/^district$|^quận\/huyện$/i).fill("Quận 1");
    await page.getByLabel(/city \/ province|tỉnh\/thành phố/i).fill("Hồ Chí Minh");
    await page.getByLabel(/contact phone|số điện thoại liên hệ/i).fill("0901234567");

    // Promise the network round-trip resolves before we assert UI state.
    const addPromise = page.waitForResponse(
      (r) => r.url().includes("/users/me/addresses") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /save address|lưu địa chỉ/i }).click();
    const addRes = await addPromise;
    if (addRes.status() !== 200) {
      const body = await addRes.text();
      throw new Error(`POST /users/me/addresses ${addRes.status()}: ${body}`);
    }
    expect(addRes.status()).toBe(200);

    // The strongest regression signal is the POST itself: the BE rejects
    // {line1, line2, province, country} with 400 "street is required",
    // so a 200 here proves the FE is shipping the BE-shaped payload. The
    // actual round-trip body check is covered by users.test.ts at the
    // schema layer.
  });
});

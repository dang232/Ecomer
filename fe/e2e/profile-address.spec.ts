import { test, expect } from "@playwright/test";

import { registerAndLoginViaOidc } from "./_auth";

const PASSWORD = "Test1234!";

test.describe("profile address add", () => {
  test("fills the address form and persists through /users/me/addresses", async ({ page }) => {
    const email = `e2e_addr_${Date.now()}@vnshop.local`;
    await registerAndLoginViaOidc(page, {
      firstName: "Addr",
      lastName: "Tester",
      email,
      password: PASSWORD,
    });
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/);
    await page.getByRole("tab", { name: /^addresses$|^\u0111\u1ecba ch\u1ec9$/i }).click();
    await page
      .getByRole("button", { name: /add address|th\u00eam \u0111\u1ecba ch\u1ec9/i })
      .click();
    await page
      .getByLabel(/street, house number|s\u1ed1 nh\u00e0, \u0111\u01b0\u1eddng/i)
      .fill("12 Le Loi");
    await page.getByLabel(/ward|ph\u01b0\u1eddng\/x\u00e3/i).fill("Ben Nghe");
    await page.getByLabel(/^district$|^qu\u1eadn\/huy\u1ec7n$/i).fill("Quan 1");
    await page.getByLabel(/city \/ province|t\u1ec9nh\/th\u00e0nh ph\u1ed1/i).fill("Ho Chi Minh");
    await page
      .getByLabel(/contact phone|s\u1ed1 \u0111i\u1ec7n tho\u1ea1i li\u00ean h\u1ec7/i)
      .fill("0901234567");
    const addPromise = page.waitForResponse(
      (r) => r.url().includes("/users/me/addresses") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: /save address|l\u01b0u \u0111\u1ecba ch\u1ec9/i })
      .click();
    const addRes = await addPromise;
    expect(addRes.status(), `POST /users/me/addresses returned ${addRes.status()}`).toBe(200);
  });
});

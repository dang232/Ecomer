import { test, expect } from "@playwright/test";

import { loginViaOidc, uniqueTestId } from "./_auth";

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

test.describe("seller registration UI", () => {
  test("lets an authenticated buyer submit a seller application", async ({ page }) => {
    const stamp = uniqueTestId();
    const email = `e2e_seller_${stamp}@example.com`;
    const shopName = `QA Shop ${stamp}`;

    const registration = await page.request.post(`${apiURL}/auth/register`, {
      data: {
        firstName: "QA",
        lastName: "Seller",
        email,
        password: PASSWORD,
      },
    });
    expect(registration.ok(), `register: ${registration.status()}`).toBeTruthy();

    await loginViaOidc(page, email, PASSWORD);
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: /personal info|thông tin cá nhân/i }),
    ).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /become a seller|trở thành người bán/i }).click();
    await expect(page).toHaveURL(/\/seller\/register$/);
    await expect(
      page.getByRole("heading", { name: /become a seller|trở thành người bán/i }),
    ).toBeVisible();

    await page.getByLabel(/shop name|tên shop/i).fill(shopName);
    await page.getByLabel(/payout bank|ngân hàng nhận tiền/i).fill("Vietcombank");
    await page.getByRole("button", { name: /submit application|gửi hồ sơ/i }).click();

    await expect(
      page.getByRole("heading", { name: /application submitted|đã gửi hồ sơ/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(shopName, { exact: true })).toBeVisible();
    await expect(page.getByText(/^(Pending review|Đang chờ duyệt)$/i)).toBeVisible();
  });
});

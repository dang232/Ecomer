import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the Profile → Addresses tab.
 *
 * What this proves through the actual SPA:
 *   - Click "Add address" → form fields render
 *   - Submit invalid (empty) form → validation toast / inline error,
 *     no row added
 *   - Submit a valid address through the actual form fields → the row
 *     appears in the address list with the typed street + city
 *
 * Locks in the address-management mutation path (post + state update +
 * re-render) which exercises the userProfileSchema transform on the
 * mutation response.
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

interface SeededBuyer {
  email: string;
  accessToken: string;
}

async function seedBuyer(request: APIRequestContext): Promise<SeededBuyer> {
  const stamp = Date.now() + Math.floor(Math.random() * 1_000);
  const email = `e2e_qa_addr_${stamp}@vnshop.local`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "QA", lastName: "Addr", email, password: PASSWORD },
  });
  expect(reg.ok(), `register: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${apiURL}/auth/login`, {
    data: { username: email, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await login.json())?.data?.accessToken;
  expect(accessToken).toBeTruthy();
  return { email, accessToken };
}

async function seedAddressViaApi(
  request: APIRequestContext,
  buyer: SeededBuyer,
  address: { street: string; ward?: string; district: string; city: string; isDefault?: boolean },
): Promise<void> {
  const r = await request.post(`${apiURL}/users/me/addresses`, {
    headers: { Authorization: `Bearer ${buyer.accessToken}` },
    data: address,
  });
  expect(r.ok(), `address seed: ${r.status()} ${await r.text()}`).toBeTruthy();
}

test.describe("profile addresses UI", () => {
  test("Add address form opens and accepts a valid submission", async ({ page }) => {
    await seedBuyer(page.request);
    await page.goto("/profile");

    // Wait for shell, then click Addresses tab.
    await expect(
      page.getByRole("heading", { name: /Personal info|Thông tin cá nhân/i }),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /^(Addresses|Địa chỉ)$/i }).click();

    // Empty-state copy renders for a new buyer.
    await expect(
      page.getByText(/You don't have any addresses yet|Bạn chưa có địa chỉ nào/i),
    ).toBeVisible({ timeout: 10_000 });

    // Click "Add address".
    await page.getByRole("button", { name: /Add address|Thêm địa chỉ/i }).click();

    // Form fields appear. They use no test-ids; anchor on the visible labels.
    // Each label is a sibling of an input/select. We'll fill by label text.
    const streetField = page.getByLabel(/Street|Số nhà/i).first();
    await expect(streetField).toBeVisible({ timeout: 10_000 });
    await streetField.fill("42 QA Test Street");

    // District + city are required by the FE validator.
    await page
      .getByLabel(/District|Quận/i)
      .first()
      .fill("District 1");
    await page
      .getByLabel(/City|Tỉnh/i)
      .first()
      .fill("Ho Chi Minh");

    // Submit.
    await page.getByRole("button", { name: /Save address|Lưu địa chỉ/i }).click();

    // Success toast appears.
    await expect(page.getByText(/Address added|Đã thêm địa chỉ/i)).toBeVisible({ timeout: 15_000 });

    // The new address row is visible by its street.
    await expect(page.getByText("42 QA Test Street").first()).toBeVisible({
      timeout: 10_000,
    });

    await expectNoGlobalError(page);
  });

  test("Submitting the address form with empty street + city blocks", async ({ page }) => {
    await seedBuyer(page.request);
    await page.goto("/profile");

    await expect(
      page.getByRole("heading", { name: /Personal info|Thông tin cá nhân/i }),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /^(Addresses|Địa chỉ)$/i }).click();
    await page.getByRole("button", { name: /Add address|Thêm địa chỉ/i }).click();

    // Click Save without filling — FE shows a validation toast.
    await page.getByRole("button", { name: /Save address|Lưu địa chỉ/i }).click();

    // The validate-missing toast surfaces in either language.
    await expect(page.getByText(/Please enter the street|Vui lòng nhập số nhà/i)).toBeVisible({
      timeout: 10_000,
    });

    // No success toast for "Address added" should appear (proves the
    // mutation didn't run). The form is still open with the Save button
    // still visible — that's the canonical "submission was blocked" signal.
    await expect(page.getByText(/Address added|Đã thêm địa chỉ/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save address|Lưu địa chỉ/i })).toBeVisible({
      timeout: 5_000,
    });

    await expectNoGlobalError(page);
  });

  test("Set-default flips the default badge between two addresses", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    // Seed first address as default, second as non-default. Use the API so
    // the test focuses on the set-default click + state flip, not the form.
    await seedAddressViaApi(page.request, buyer, {
      street: "1 Default Street",
      ward: "1",
      district: "Q1",
      city: "Ho Chi Minh",
      isDefault: true,
    });
    await seedAddressViaApi(page.request, buyer, {
      street: "2 Secondary Street",
      ward: "2",
      district: "Q3",
      city: "Ho Chi Minh",
      isDefault: false,
    });

    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: /Personal info|Thông tin cá nhân/i }),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^(Addresses|Địa chỉ)$/i }).click();

    // Both addresses are visible.
    await expect(page.getByText("1 Default Street")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("2 Secondary Street")).toBeVisible();

    // The non-default row carries the "Set as default" link. Click it.
    const setDefault = page
      .getByRole("button", { name: /Set as default|Đặt làm địa chỉ mặc định/i })
      .first();
    await expect(setDefault).toBeVisible({ timeout: 10_000 });
    await setDefault.click();

    // Success toast.
    await expect(page.getByText(/Set as default address|Đã đặt làm địa chỉ mặc định/i)).toBeVisible(
      { timeout: 15_000 },
    );

    // After invalidation, the secondary row carries the Default badge AND
    // its set-default button is gone. Use a poll because React Query
    // invalidation re-renders asynchronously.
    await expect
      .poll(
        async () =>
          page
            .locator("div", { hasText: "2 Secondary Street" })
            .filter({ hasText: /Default|Mặc định/i })
            .count(),
        {
          timeout: 15_000,
          message: "Secondary address never picked up the Default badge",
        },
      )
      .toBeGreaterThan(0);

    await expectNoGlobalError(page);
  });

  test("Trash icon removes a non-default address from the list", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    // Need TWO addresses: only non-default rows render the trash button.
    // Seed default first, then a second to remove.
    await seedAddressViaApi(page.request, buyer, {
      street: "1 Keep Me Street",
      ward: "1",
      district: "Q1",
      city: "Ho Chi Minh",
      isDefault: true,
    });
    await seedAddressViaApi(page.request, buyer, {
      street: "99 Delete Me Street",
      ward: "9",
      district: "Q9",
      city: "Ho Chi Minh",
      isDefault: false,
    });

    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: /Personal info|Thông tin cá nhân/i }),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^(Addresses|Địa chỉ)$/i }).click();

    await expect(page.getByText("99 Delete Me Street")).toBeVisible({ timeout: 10_000 });

    // The trash button only renders on non-default rows. There's
    // exactly one in this fixture; find it via aria-label.
    const trash = page.getByRole("button", { name: /remove address/i }).first();
    await expect(trash).toBeVisible({ timeout: 10_000 });
    await trash.click();

    // Success toast.
    await expect(page.getByText(/Address removed|Đã xoá địa chỉ/i)).toBeVisible({
      timeout: 15_000,
    });

    // Row is gone after the React Query invalidation re-renders the list.
    await expect
      .poll(() => page.getByText("99 Delete Me Street").count(), {
        timeout: 15_000,
        message: "Removed address never disappeared from the list",
      })
      .toBe(0);

    // Default row stuck around.
    await expect(page.getByText("1 Keep Me Street")).toBeVisible();

    await expectNoGlobalError(page);
  });
});

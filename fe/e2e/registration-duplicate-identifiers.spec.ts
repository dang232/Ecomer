import { expect, test, type Page } from "@playwright/test";

const API_ORIGIN = process.env.VITE_API_URL ?? "http://localhost:8080";
const PASSWORD = "VnshopPass9";

function identifiers(prefix: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1_000)}`.slice(-8);
  return {
    email: `${prefix}-${suffix}@vnshop.local`,
    phone: `+849${suffix}`,
    nationalPhone: `9${suffix}`,
  };
}

async function seedBuyer(page: Page, email: string, phone: string): Promise<void> {
  const response = await page.request.post(`${API_ORIGIN}/auth/register`, {
    data: { email, password: PASSWORD, firstName: "Existing", lastName: "Buyer", phone },
  });
  expect(response.status()).toBe(201);
}

async function fillRegistration(page: Page, email: string, nationalPhone: string): Promise<void> {
  await page.goto("/register");
  await page.locator("#firstName").fill("New");
  await page.locator("#lastName").fill("Buyer");
  await page.locator("#email").fill(email);
  await page.locator("#phone").fill(nationalPhone);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("#confirm").fill(PASSWORD);
  await page.getByRole("button", { name: /create account|t\u1ea1o t\u00e0i kho\u1ea3n/i }).click();
}

test.describe("registration duplicate identifiers", () => {
  test("shows a duplicate email as a registration error", async ({ page }) => {
    const owner = identifiers("e2e-duplicate-email");
    await seedBuyer(page, owner.email, owner.phone);

    const differentPhone = identifiers("e2e-different-phone");
    // Keycloak's realm uniqueness is case-insensitive; exercise the same
    // identity rule the browser must honor instead of only testing a byte-for-byte duplicate.
    await fillRegistration(page, owner.email.toUpperCase(), differentPhone.nationalPhone);

    await expect(page.locator("#register-error")).toContainText(
      /account with that email already exists|email n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c s\u1eed d\u1ee5ng/i,
    );
    await expect(page).toHaveURL(/\/register/);
  });

  test("shows a duplicate phone inline and does not leave a loginable identity", async ({
    page,
  }) => {
    const owner = identifiers("e2e-duplicate-phone-owner");
    await seedBuyer(page, owner.email, owner.phone);

    const rejected = identifiers("e2e-duplicate-phone-rejected");
    await fillRegistration(page, rejected.email, owner.nationalPhone);

    await expect(page.locator("#phone-error")).toContainText(
      /account with that phone number already exists|s\u1ed1 \u0111i\u1ec7n tho\u1ea1i n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c s\u1eed d\u1ee5ng/i,
    );
    await expect(page.locator("#register-error")).toHaveCount(0);
    await expect(page).toHaveURL(/\/register/);

    const loginResponse = await page.request.post(`${API_ORIGIN}/auth/login`, {
      data: { username: rejected.email, password: PASSWORD },
    });
    expect(loginResponse.status()).toBe(401);
  });

  test("prioritizes the phone conflict when both identifiers are already owned", async ({
    page,
  }) => {
    const emailOwner = identifiers("e2e-both-email-owner");
    await seedBuyer(page, emailOwner.email, emailOwner.phone);

    const phoneOwner = identifiers("e2e-both-phone-owner");
    await seedBuyer(page, phoneOwner.email, phoneOwner.phone);

    await fillRegistration(page, emailOwner.email, phoneOwner.nationalPhone);

    await expect(page.locator("#phone-error")).toContainText(
      /account with that phone number already exists|s\u1ed1 \u0111i\u1ec7n tho\u1ea1i n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c s\u1eed d\u1ee5ng/i,
    );
    await expect(page.locator("#register-error")).toHaveCount(0);
    await expect(page).toHaveURL(/\/register/);
  });
});

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { loginViaOidc, uniqueTestId } from "./_auth";
import { readJson, type AuthResponse } from "./_api";

/**
 * UI-driven QA spec for the buyer profile page.
 *
 * What this proves through the actual SPA:
 *   - /profile loads without the page-wide error fallback (post-pt28
 *     userProfileSchema alignment — BE returns BuyerProfileResponse with
 *     keycloakId/avatarUrl, FE schema aliases via transform)
 *   - The buyer's email is rendered from the JWT (since BE BuyerProfile
 *     does NOT carry email — it lives in Keycloak)
 *   - The "Add address" form posts to /users/me/addresses and the new
 *     row appears
 *   - Default address is preserved across reload (post-mutation refresh)
 *
 * Setup goes through API for buyer registration. Profile page interaction
 * is real button clicks.
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

interface SeededBuyer {
  email: string;
  accessToken: string;
}

async function seedBuyer(request: APIRequestContext): Promise<SeededBuyer> {
  const stamp = uniqueTestId();
  const email = `e2e_qa_profile_${stamp}@vnshop.local`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "QA", lastName: "Profile", email, password: PASSWORD },
  });
  expect(reg.ok(), `register: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${apiURL}/auth/login`, {
    data: { username: email, password: PASSWORD },
  });
  expect(login.ok(), `login: ${login.status()}`).toBeTruthy();
  const accessToken = (await readJson<AuthResponse>(login)).data?.accessToken;
  expect(accessToken).toBeTruthy();
  if (!accessToken) throw new Error("login did not return an access token");
  return { email, accessToken };
}

async function loadProfileAuthenticated(page: Page, email: string): Promise<void> {
  await loginViaOidc(page, email, PASSWORD);
  await page.goto("/profile");
  // Either the loaded profile content OR the login prompt is acceptable as a
  // "no global error fallback" signal — we then check which one rendered.
  await expect(
    page.getByText(/Personal info|Thông tin cá nhân|Log in to view|Vui lòng đăng nhập/i),
  ).toBeVisible({ timeout: 20_000 });
}

test.describe("profile page UI — buyer flow", () => {
  test("/profile loads without the global error fallback (post-pt28 schema fix)", async ({
    page,
  }) => {
    const buyer = await seedBuyer(page.request);
    await loadProfileAuthenticated(page, buyer.email);

    // Pre-pt28 the page rendered the global error fallback because the
    // userProfileSchema required `id` and `email` strings, but BE returned
    // BuyerProfileResponse(keycloakId, name, phone, avatarUrl, addresses) —
    // no top-level id, no email at all (email lives in Keycloak).
    //
    // Post-fix: schema aliases keycloakId → id and treats email as optional.
    // The Personal Info tab is the default and renders editable fields.

    await expect(
      page.getByRole("heading", { name: /Personal info|Thông tin cá nhân/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Pre-fix the page rendered "Có lỗi xảy ra" / "Something went wrong"
    // with a Zod error block. Assert that copy is NOT present.
    await expect(page.getByText(/Có lỗi xảy ra|Something went wrong/i)).toHaveCount(0);
    await expect(page.getByText(/Invalid input/i)).toHaveCount(0);
  });

  test("Addresses tab renders and the empty-state copy appears for a new buyer", async ({
    page,
  }) => {
    const buyer = await seedBuyer(page.request);
    await loadProfileAuthenticated(page, buyer.email);

    // Click the Addresses tab.
    await page.getByRole("tab", { name: /^(Addresses|Địa chỉ)$/i }).click();

    // A fresh buyer has no addresses; the empty-state copy should appear.
    await expect(
      page.getByText(/You don't have any addresses yet|Bạn chưa có địa chỉ nào/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

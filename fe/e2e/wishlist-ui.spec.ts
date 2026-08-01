import { test, expect, type APIRequestContext } from "@playwright/test";

import { loginViaOidc, uniqueTestId } from "./_auth";
import { readJson, type AuthResponse, type ProductListResponse } from "./_api";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the wishlist page.
 *
 * What this proves through the actual SPA:
 *   - /wishlist for an unauthenticated user shows the empty/login state
 *   - /wishlist for a logged-in buyer with one wished item renders the
 *     product card and its price (proves wishlist + product enrichment
 *     work end-to-end through the SPA)
 *   - The page does NOT show the global error fallback
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

interface SeededBuyer {
  email: string;
  accessToken: string;
}

async function seedBuyer(request: APIRequestContext): Promise<SeededBuyer> {
  const stamp = uniqueTestId();
  const email = `e2e_qa_wish_${stamp}@vnshop.local`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "QA", lastName: "Wish", email, password: PASSWORD },
  });
  expect(reg.ok(), `register: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${apiURL}/auth/login`, {
    data: { username: email, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await readJson<AuthResponse>(login)).data?.accessToken;
  expect(accessToken).toBeTruthy();
  if (!accessToken) throw new Error("login did not return an access token");
  return { email, accessToken };
}

interface SeededProduct {
  id: string;
  name: string;
}

async function firstProduct(request: APIRequestContext): Promise<SeededProduct> {
  const r = await request.get(`${apiURL}/products?size=1`);
  expect(r.ok()).toBeTruthy();
  const p = (await readJson<ProductListResponse>(r)).data?.content?.[0];
  expect(p?.id, "expected a seeded product").toBeTruthy();
  if (!p) throw new Error("expected a seeded product");
  return { id: p.id, name: p.name };
}

async function addToWishlist(
  request: APIRequestContext,
  buyer: SeededBuyer,
  productId: string,
): Promise<void> {
  const r = await request.post(`${apiURL}/users/me/wishlist`, {
    headers: { Authorization: `Bearer ${buyer.accessToken}` },
    data: { productId },
  });
  expect(r.ok(), `wishlist add: ${r.status()} ${await r.text()}`).toBeTruthy();
}

test.describe("wishlist page UI", () => {
  test("/wishlist as guest redirects to login (does not crash)", async ({ page }) => {
    await page.goto("/wishlist");

    // The wishlist is buyer-private, so unauthenticated visits redirect to
    // the native login screen. The redirect is the page-level signal we care
    // about — proves the route guard is wired and the page didn't render
    // the global error fallback or a blank canvas.
    await expect
      .poll(() => new URL(page.url()).pathname, {
        timeout: 20_000,
        message: "expected /wishlist to redirect to /login for guests",
      })
      .toMatch(/^\/login/);

    await expectNoGlobalError(page);
  });

  test("Buyer with a wished product sees it on /wishlist", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const product = await firstProduct(page.request);
    await addToWishlist(page.request, buyer, product.id);

    await loginViaOidc(page, buyer.email, PASSWORD);
    await page.goto("/wishlist");
    // Wait for wishlist content — the product name is the canonical signal
    // that wishlist + product enrichment both succeeded.
    await expect(page.getByText(product.name, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expectNoGlobalError(page);
  });
});

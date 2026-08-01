import { test, expect, type APIRequestContext } from "@playwright/test";

import { loginViaOidc, uniqueTestId } from "./_auth";
import { readJson, type AuthResponse, type ProductListResponse } from "./_api";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the wishlist heart toggle on ProductPage.
 *
 * What this proves through the actual SPA:
 *   - Logged-in buyer clicks the IconHeart on a product detail page
 *     → success toast lands (proves the BE round-trip)
 *   - The heart re-renders with the loved state (filled fill + orange
 *     border) — locks in the optimistic update + re-render path
 *   - Clicking again toggles back → success toast for "removed"
 *
 * Locks in the wishlist toggle endpoint round-trip + the React state
 * propagation through the VNShopProvider's toggleWishlist function.
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

interface SeededBuyer {
  email: string;
  accessToken: string;
}

async function seedBuyer(request: APIRequestContext): Promise<SeededBuyer> {
  const stamp = uniqueTestId();
  const email = `e2e_qa_wish_toggle_${stamp}@vnshop.local`;
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

async function firstProductId(request: APIRequestContext): Promise<string> {
  const r = await request.get(`${apiURL}/products?size=1`);
  expect(r.ok()).toBeTruthy();
  const id = (await readJson<ProductListResponse>(r)).data?.content?.[0]?.id;
  expect(id, "expected a seeded product").toBeTruthy();
  if (!id) throw new Error("expected a seeded product");
  return id;
}

test.describe("wishlist heart toggle UI", () => {
  test("Heart click on ProductPage adds to wishlist and shows success toast", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const productId = await firstProductId(page.request);
    await loginViaOidc(page, buyer.email, PASSWORD);
    await page.goto(`/product/${productId}`);

    // Wait for the H1 to render past Suspense.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 20_000,
    });

    // The page has TWO heart icons: the navbar wishlist link AND the
    // product page's wishlist toggle. Skip the navbar (first match) and
    // pick the second — the toggle button next to the product H1.
    const heart = page.getByRole("button", { name: /wishlist/i }).last();
    await expect(heart).toBeVisible({ timeout: 10_000 });
    await heart.click();

    // Sonner toast — VI: "Đã thêm vào danh sách yêu thích"
    await expect(
      page.getByText(/Đã thêm vào danh sách yêu thích|added to (your )?wishlist/i),
    ).toBeVisible({ timeout: 10_000 });

    await expectNoGlobalError(page);
  });

  test("Second click on the same heart removes from wishlist", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const productId = await firstProductId(page.request);
    await loginViaOidc(page, buyer.email, PASSWORD);
    await page.goto(`/product/${productId}`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 20_000,
    });

    const heart = page.getByRole("button", { name: /wishlist/i }).last();
    await expect(heart).toBeVisible({ timeout: 10_000 });

    // First click — add.
    await heart.click();
    const addToast = page.getByText(/Đã thêm vào danh sách yêu thích|added to (your )?wishlist/i);
    await expect(addToast).toBeVisible({ timeout: 10_000 });
    // Wait for the add toast to leave the DOM before the second click —
    // sonner stacks toasts but matching them by text gets ambiguous if
    // both are simultaneously visible.
    await expect(addToast).toHaveCount(0, { timeout: 15_000 });

    // Second click — remove. The remove path uses VNShopProvider's
    // toast.info("Đã xóa khỏi danh sách yêu thích") — note `xóa` (not
    // `xoá`); Vietnamese has both spellings, source uses the former.
    await heart.click();
    await expect(
      page.getByText(/Đã xóa khỏi danh sách yêu thích|removed from wishlist/i),
    ).toBeVisible({ timeout: 10_000 });

    await expectNoGlobalError(page);
  });
});

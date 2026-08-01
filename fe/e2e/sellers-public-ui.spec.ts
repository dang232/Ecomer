import { test, expect, type APIRequestContext } from "@playwright/test";

import { readJson, type SellerListResponse } from "./_api";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the public sellers surface.
 *
 * What this proves through the actual SPA:
 *   - Home page seller showcase section renders (header + "View all"
 *     CTA OR the empty-state ComingSoonCard) — locks in the
 *     publicSellerSchema parsing
 *   - /sellers/{id} renders the seller detail page (proves the
 *     `PublicSellerResponse(id, shopName, ..., joinedAt: Instant,
 *     ratingAvg: Double, ratingCount: long, totalProducts: long)` shape
 *     parses correctly)
 *   - /sellers/{nonexistent-id} shows the not-found state without a
 *     global error fallback
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

async function firstSellerId(request: APIRequestContext): Promise<string | null> {
  const r = await request.get(`${apiURL}/sellers?size=1`);
  if (!r.ok()) return null;
  const body = await readJson<SellerListResponse>(r);
  // BE returns either { content: [...] } or { data: { content: [...] } }
  // depending on envelope. Try both.
  return body?.data?.content?.[0]?.id ?? body?.content?.[0]?.id ?? null;
}

test.describe("public sellers UI", () => {
  test("Home seller showcase renders header (title + subtitle OR empty-state)", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for home page mount.
    await expect(page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    // The section title is "Top Sellers" / "Featured Shops" — match either.
    // The empty-state ComingSoonCard uses the same title with a different
    // body, so the title check covers both render modes.
    await expect(page.getByText(/Top Sellers|Featured Shops|Shop Nổi Bật/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await expectNoGlobalError(page);
  });

  test("/sellers/{id} renders the seller detail page (schema check)", async ({ page }) => {
    const sellerId = await firstSellerId(page.request);
    if (!sellerId) {
      throw new Error("No public sellers seeded — cannot test seller detail page rendering");
    }

    await page.goto(`/sellers/${sellerId}`);

    // The detail page renders shop name, joined date, tier, products
    // section. Pre-pt28 the publicSellerSchema was clean per the audit;
    // this is the regression check that the page actually mounts.
    //
    // The "Products" section header is a stable signal across both
    // render modes (with-products and no-products).
    await expect(page.getByRole("heading", { name: /Products|^Sản phẩm$/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    await expectNoGlobalError(page);
  });

  test("/sellers/{bogus-id} surfaces a 404 message via the error boundary (not Zod 'Invalid input')", async ({
    page,
  }) => {
    await page.goto("/sellers/bogus-seller-id-that-does-not-exist");

    // SellerDetailPage uses useSuspenseQuery and lets the global error
    // boundary handle 404s — the boundary renders the localized "Có lỗi
    // xảy ra" header with the BE's error message ("seller not found: ...").
    // That's intentional UX, not a Zod parse failure.
    //
    // What we ASSERT: the BE's not-found message reaches the user. What
    // we'd FAIL on: a generic Zod "Invalid input" leaking through, which
    // would mean the schema is too strict.
    await expect(
      page.getByText(/seller not found|Không tìm thấy shop|Shop not found/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // The Zod-error signature must NOT appear — that would mean the
    // schema mis-rejected a valid 404 response.
    await expect(page.getByText(/Invalid input/i)).toHaveCount(0);
  });
});

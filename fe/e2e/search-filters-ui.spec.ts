import { test, expect, type Page } from "@playwright/test";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for search-page filter interactions.
 *
 * What this proves through the actual SPA:
 *   - Typing a query in the search bar and submitting changes the
 *     result-header copy to "Results for X"
 *   - Clicking a sort option flips the active radio indicator
 *   - The Clear-all button only appears once a filter is active,
 *     and clicking it removes the filter
 *
 * No backend or auth needed. Runs on /search as a guest.
 */

test.describe("search filters UI", () => {
  test("Submitting a query updates the result-header copy to 'Results for X'", async ({ page }) => {
    await page.goto("/search");
    await expect(
      page.getByText(/All products|Tất cả sản phẩm|No products found/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // The autocomplete bar is at the top of the search page. Combobox
    // role corresponds to the input. Match by its aria-attributes.
    const input = page.getByRole("combobox").first();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("phone");
    await input.press("Enter");

    // The result header swaps from "All products" to "Results for "phone"".
    await expect(page.getByText(/Results for "phone"|Kết quả cho "phone"/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await expectNoGlobalError(page);
  });

  test("Sort pill activation re-renders the active state", async ({ page }) => {
    await page.goto("/search");
    await expect(
      page.getByText(/All products|Tất cả sản phẩm|No products found/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // The current UI exposes sorting as pills in the results toolbar.
    const ascendingBtn = page
      .getByRole("button", { name: /Price ascending|Giá tăng dần/i })
      .first();
    await expect(ascendingBtn).toBeVisible({ timeout: 10_000 });
    await ascendingBtn.click();
    await expect(ascendingBtn).toHaveClass(/bg-primary/);

    await expectNoGlobalError(page);
  });

  test("Clear-all button appears once a filter is active and clears it on click", async ({
    page,
  }) => {
    // The Clear-all button renders only when activeFilterCount > 0, which
    // counts selectedCat / selectedBrand / priceMin / priceMax / minRating /
    // freeShipOnly. The text-search query does NOT count, so use a category
    // filter to trigger the button.
    await page.goto("/search?cat=electronics");
    await expect(
      page.getByText(/All products|Tất cả sản phẩm|No products found|Không tìm thấy/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    const clearBtn = page.getByRole("button", { name: /^(Clear all|Xóa tất cả)$/i }).first();
    await expect(clearBtn).toBeVisible({ timeout: 10_000 });
    await clearBtn.click();

    // After clicking, the Clear-all button is gone (no active filters left).
    await expect(page.getByRole("button", { name: /^(Clear all|Xóa tất cả)$/i })).toHaveCount(0, {
      timeout: 10_000,
    });

    await expectNoGlobalError(page);
  });

  test("Category filter keeps catalog products when the search index is empty", async ({
    page,
    request,
  }) => {
    const response = await request.get(
      "http://localhost:8080/products?categoryId=electronics&size=50",
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const catalogCount = body?.data?.totalElements ?? 0;
    expect(catalogCount).toBeGreaterThan(0);

    await page.goto("/search?cat=electronics");
    const cards = page.locator('div[role="link"][aria-label]');
    await expect(cards).toHaveCount(Math.min(catalogCount, 20), { timeout: 20_000 });
    await expect(page.getByText(/No products found|KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m/i)).toHaveCount(
      0,
    );
    await expectNoGlobalError(page);
  });

  test("Price range rejects negative and descending values before applying", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator('input[type="number"]')).toHaveCount(2, { timeout: 20_000 });

    const inputs = page.locator('input[type="number"]');
    const apply = page.getByRole("button", { name: /Apply|Áp dụng/i }).first();

    await inputs.nth(0).fill("2");
    await inputs.nth(1).fill("-4");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(apply).toBeDisabled();
    await expect(page).not.toHaveURL(/priceMin=2|priceMax=-4/);

    await inputs.nth(1).fill("20");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(apply).toBeEnabled();
    await apply.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("priceMin")).toBe("2");
    await expect.poll(() => new URL(page.url()).searchParams.get("priceMax")).toBe("20");

    await expectNoGlobalError(page);
  });
});

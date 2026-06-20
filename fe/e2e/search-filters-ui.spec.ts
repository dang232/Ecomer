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
  test("Submitting a query updates the result-header copy to 'Results for X'", async ({
    page,
  }) => {
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
    await expect(
      page.getByText(/Results for "phone"|Kết quả cho "phone"/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await expectNoGlobalError(page);
  });

  test("Sort radio button activation re-renders the indicator dot", async ({ page }) => {
    await page.goto("/search");
    await expect(
      page.getByText(/All products|Tất cả sản phẩm|No products found/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // The sort group is in the sidebar. Default is "popular" — click
    // "Highest rated" / "Đánh giá cao" and assert the active style flips.
    // We sample the inline color attribute of the row's button which
    // changes from #4b5563 (gray) to #00BFB3 (teal) when active.
    const ratingBtn = page.getByRole("button", {
      name: /Highest rated|Đánh giá cao/i,
    }).first();
    await expect(ratingBtn).toBeVisible({ timeout: 10_000 });
    await ratingBtn.click();

    // After click, the button's color style should be the brand teal.
    // Browsers normalize `style="color: #00BFB3"` to "rgb(0, 191, 179)";
    // match either form so the assertion isn't browser-specific.
    await expect.poll(
      async () => {
        const color = await ratingBtn.evaluate((el) =>
          (el as HTMLElement).style.color,
        );
        return color;
      },
      {
        timeout: 5_000,
        message: "Sort 'Highest rated' button never received the active color",
      },
    ).toMatch(/00BFB3|#00bfb3|rgb\(0,\s*191,\s*179\)/i);

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
    await expect(
      page.getByRole("button", { name: /^(Clear all|Xóa tất cả)$/i }),
    ).toHaveCount(0, { timeout: 10_000 });

    await expectNoGlobalError(page);
  });
});

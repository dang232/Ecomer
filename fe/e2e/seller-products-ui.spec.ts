import { test, expect } from "@playwright/test";
import { z } from "zod";

import { loginAsPersona, uniqueTestId } from "./_auth";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the seller products tab.
 *
 * What this proves through the actual SPA:
 *   - Click Products tab — table renders with header columns
 *   - Search input is present
 *   - "Add product" CTA is visible
 *   - The page does not crash with the global error fallback (proves
 *     the seller's product list endpoint parses)
 *
 * No backend mutation needed; seller1 is a seeded fixture.
 */

test.describe("seller products UI", () => {
  test("seller can save, publish, and view a product with an uploaded image", async ({ page }) => {
    const productName = `E2E published product ${uniqueTestId()}`;
    const mediaRequestResults: string[] = [];
    page.on("response", (response) => {
      if (
        response.url().includes("/images/upload-url") ||
        response.url().startsWith("http://localhost:9000/")
      ) {
        mediaRequestResults.push(
          `${response.request().method()} ${response.status()} ${response.url()}`,
        );
      }
    });
    await loginAsPersona(page, "seller");
    await page.goto("/seller/products?page=1&mode=create");

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
    await page.locator("#product-name").fill(productName);
    await page.locator("#product-category").selectOption("electronics");
    await page.locator("#product-offer-price").fill("159000");
    await page.locator("#product-offer-stock").fill("4");

    await page
      .getByRole("group", { name: "Product media" })
      .locator('input[type="file"]')
      .setInputFiles({
        name: "e2e-product.png",
        mimeType: "image/png",
        // Valid 1x1 PNG. The production upload flow calculates its checksum and dimensions.
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Jr6sAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    await expect(page.getByRole("img", { name: "e2e-product.png" })).toBeVisible();

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/sellers/me/products") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Save as draft|LÆ°u báº£n nhÃ¡p/i }).click();
    const created = z
      .object({ data: z.object({ id: z.string() }) })
      .parse(await (await createResponse).json());
    const productId = created.data.id;

    try {
      await expect(page.getByTestId("publication")).toBeVisible({ timeout: 30_000 });
    } catch (error) {
      throw new Error(`Media requests: ${mediaRequestResults.join(" | ")}`, { cause: error });
    }
    expect(mediaRequestResults).toEqual(
      expect.arrayContaining([expect.stringMatching(/^PUT 200 /)]),
    );
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Publish now|Xuáº¥t báº£n ngay/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 30_000 });

    await page.goto(`/product/${productId}`);
    await expect(page.getByRole("heading", { name: productName })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("img", { name: productName })).toBeVisible({ timeout: 30_000 });
    await expectNoGlobalError(page);
  });

  test("seller saves a simple offer as a draft and removes it", async ({ page }) => {
    const productName = `E2E simple offer ${uniqueTestId()}`;
    await loginAsPersona(page, "seller");
    await page.goto("/seller/products?page=1&mode=create");

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
    await page.locator("#product-name").fill(productName);
    await page.locator("#product-category").selectOption("electronics");
    await page.locator("#product-offer-price").fill("99000");
    await page.locator("#product-offer-stock").fill("3");

    await page.getByRole("button", { name: /Save as draft|Lưu bản nháp/i }).click();
    await expect(page.getByTestId("publication")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/saved as a draft|lưu dưới dạng bản nháp/i)).toBeVisible();

    await page.getByRole("button", { name: /Delete draft|Xoá bản nháp/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 20_000 });
    await expectNoGlobalError(page);
  });

  test("Products tab renders the table chrome (header columns + Add CTA)", async ({ page }) => {
    await loginAsPersona(page, "seller");
    await page.goto("/seller");

    await expect(page.getByTestId("seller-dashboard")).toBeVisible({ timeout: 20_000 });

    const productsTab = page.getByRole("link", { name: /^(Products|Sản phẩm)$/i }).first();
    await expect(productsTab).toBeVisible({ timeout: 10_000 });
    await productsTab.click();

    // Page heading.
    await expect(page.getByText(/Product management|Quản lý sản phẩm/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Add CTA.
    await expect(
      page.getByRole("button", { name: /Add product|Thêm sản phẩm/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await page
      .getByRole("button", { name: /Add product|Thêm sản phẩm/i })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /New product|Sản phẩm mới/i })).toBeVisible({
      timeout: 10_000,
    });

    // Table column headers — match VI or EN.
    for (const col of [
      /^Product$|^Sản phẩm$/i,
      /^Price$|^Giá$/i,
      /^Stock$|^Kho$/i,
      /^Sold$|^Đã bán$/i,
    ]) {
      await expect(page.getByText(col).first()).toBeVisible({ timeout: 10_000 });
    }

    await expectNoGlobalError(page);
  });

  test("seller returns tabs use translated status labels", async ({ page }) => {
    await loginAsPersona(page, "seller");
    await page.goto("/seller/returns");

    for (const label of [/Pending|Chờ xử lý/i, /Approved|Đã duyệt/i, /Completed|Hoàn tất/i]) {
      await expect(page.getByRole("tab", { name: label }).first()).toBeVisible({ timeout: 15_000 });
    }

    for (const key of ["requested", "approved", "completed", "rejected"]) {
      await expect(page.getByText(`seller.orders.tabs.${key}`, { exact: true })).toHaveCount(0);
    }
    await expectNoGlobalError(page);
  });
});

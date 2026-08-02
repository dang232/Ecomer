import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import { z } from "zod";

import { loginAsPersona, uniqueTestId } from "./_auth";

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "product-video.webm",
);

const createdProductSchema = z.object({ data: z.object({ id: z.string().min(1) }) });

test.describe("seller product video editor", () => {
  test("persists a draft before driving the browser TUS upload path", async ({ page }) => {
    test.skip(
      process.env.RUN_VIDEO_TUS_E2E !== "1",
      "Set RUN_VIDEO_TUS_E2E=1 with the local gateway, product service, Kafka, and MinIO stack.",
    );

    await loginAsPersona(page, "seller");
    await page.goto("/seller/products?page=1&mode=create");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /upload a product video/i })).toHaveCount(0);

    await page.locator("#product-name").fill(`E2E video product ${uniqueTestId()}`);
    await page.locator("#product-category").selectOption("electronics");
    await page.locator("#product-offer-price").fill("129000");
    await page.locator("#product-offer-stock").fill("2");

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/sellers/me/products") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Save as draft|L[uư]u b[aả]n nh[aá]p/i }).click();
    const productId = createdProductSchema.parse(await (await createResponse).json()).data.id;

    const uploadDropzone = page.getByRole("button", { name: /upload a product video/i });
    await expect(uploadDropzone).toBeVisible({ timeout: 30_000 });

    const tusCreate = page.waitForResponse(
      (response) =>
        response.url().includes("/videos/upload") && response.request().method() === "POST",
    );
    const tusPatch = page.waitForRequest(
      (request) => request.url().includes("/videos/upload/") && request.method() === "PATCH",
    );
    const videoInput = page.locator('input[type="file"][accept*="video/mp4"]');
    await videoInput.setInputFiles({
      name: "product-video.webm",
      mimeType: "video/webm",
      buffer: await readFile(fixturePath),
    });

    const tusCreateResponse = await tusCreate;
    expect(tusCreateResponse.status()).toBe(201);
    expect(tusCreateResponse.request().headers()["upload-metadata"]).toContain(
      Buffer.from(productId, "utf8").toString("base64"),
    );
    await tusPatch;

    await expect(page.getByTestId("product-video-fields")).toBeVisible();
    await expect(page.getByText(/Uploading|Upload complete|processing/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import { z } from "zod";

import { loginAsPersona, uniqueTestId } from "./_auth";

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "product-video.mp4",
);

const createdProductSchema = z.object({ data: z.object({ id: z.string().min(1) }) });

test.describe("seller product video editor", () => {
  test("persists a draft before driving the browser TUS upload path", async ({ page }) => {
    test.setTimeout(180_000);
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

    const statusResponses: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/videos/") && response.url().includes("/status")) {
        statusResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    const tusCreate = page.waitForResponse(
      (response) =>
        response.url().includes("/videos/upload") && response.request().method() === "POST",
    );
    const tusPatch = page.waitForRequest(
      (request) => request.url().includes("/videos/upload/") && request.method() === "PATCH",
    );
    const publishedStatus = page.waitForResponse(
      async (response) => {
        if (!response.url().includes("/videos/") || !response.url().endsWith("/status")) {
          return false;
        }
        if (response.request().method() !== "GET" || !response.ok()) return false;
        try {
          const body = (await response.json()) as { data?: { status?: string } };
          return body.data?.status === "PUBLISHED";
        } catch {
          return false;
        }
      },
      { timeout: 120_000 },
    );
    const videoInput = page.locator('input[type="file"][accept*="video/mp4"]');
    await videoInput.setInputFiles({
      name: "product-video.mp4",
      mimeType: "video/mp4",
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

    let publishedStatusResponse;
    try {
      publishedStatusResponse = await publishedStatus;
    } catch (error) {
      throw new Error(`Video status responses: ${statusResponses.join(" | ") || "none"}`, {
        cause: error,
      });
    }
    expect(publishedStatusResponse.status()).toBe(200);

    const publishProductResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/sellers/me/products/${productId}/publish`) &&
        response.request().method() === "PUT",
    );
    await page.getByRole("button", { name: /Publish now|ÄÄƒng b[aáº£]n/i }).click();
    expect((await publishProductResponse).status()).toBe(200);

    const publicProductResponse = await page.request.get(
      `http://localhost:8080/products/${productId}`,
    );
    expect(publicProductResponse.status()).toBe(200);
    const publicProductBody = (await publicProductResponse.json()) as {
      data?: { id?: string };
    };
    expect(publicProductBody.data?.id).toBe(productId);

    const publicVideosResponse = await page.request.get(
      `http://localhost:8080/videos?entityId=${productId}&context=PRODUCT`,
    );
    expect(publicVideosResponse.status()).toBe(200);
    const publicVideosBody = (await publicVideosResponse.json()) as {
      data?: { videos?: { status?: string; playbackUrl?: string; thumbnailUrl?: string }[] };
    };
    const [publicVideo] = publicVideosBody.data?.videos ?? [];
    expect(publicVideo?.status).toBe("PUBLISHED");
    expect(publicVideo?.playbackUrl).toMatch(/\/vnshop-videos\//);
    expect(publicVideo?.thumbnailUrl).toMatch(/\/vnshop-videos\//);

    const playbackUrl = publicVideo?.playbackUrl;
    expect(playbackUrl).toBeTruthy();
    if (!playbackUrl) throw new Error("published video did not include a playback URL");
    const publicMediaResponse = await page.request.get(playbackUrl);
    expect(publicMediaResponse.status()).toBe(200);
    expect(Number(publicMediaResponse.headers()["content-length"] ?? 0)).toBeGreaterThan(0);
  });
});

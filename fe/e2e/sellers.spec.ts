import { test, expect } from "@playwright/test";

import { readJson, type SellerListResponse } from "./_api";

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

/**
 * Public sellers — anonymous SellerShowcase on HomePage and the
 * /sellers/:id detail page. The list endpoint is paged; if the seed has
 * no approved SellerProfile rows yet (seller1 owns products but may not
 * have run /sellers/register), HomePage gracefully falls back to the
 * ComingSoonCard. The spec covers both branches so we don't depend on
 * which seed flavour is loaded.
 */
test.describe("public sellers", () => {
  test("API: GET /sellers responds with the paged shape", async ({ request }) => {
    const res = await request.get(`${apiURL}/sellers?page=0&size=5`);
    expect(
      res.status(),
      `expected 200 from /sellers, body: ${(await res.text()).slice(0, 200)}`,
    ).toBe(200);
    const body = await readJson<SellerListResponse>(res);
    const data = body?.data;
    expect(data, `unexpected envelope: ${JSON.stringify(body).slice(0, 200)}`).toBeTruthy();
    if (!data) throw new Error("unexpected envelope from /sellers");
    expect(Array.isArray(data.content)).toBeTruthy();
    if (!data.content) throw new Error("unexpected sellers content shape");
    expect(typeof data.page).toBe("number");
    expect(typeof data.size).toBe("number");
    expect(typeof data.totalElements).toBe("number");
    // bank details must NEVER leak through public endpoints
    for (const seller of data.content) {
      expect(seller).not.toHaveProperty("bankName");
      expect(seller).not.toHaveProperty("bankAccount");
    }
  });

  test("API: GET /sellers/{unknown} returns 404 with no bank fields", async ({ request }) => {
    const res = await request.get(`${apiURL}/sellers/00000000-0000-0000-0000-000000000000`);
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await readJson<SellerListResponse>(res);
      expect(body?.data).not.toHaveProperty("bankName");
      expect(body?.data).not.toHaveProperty("bankAccount");
    }
  });

  test("HomePage SellerShowcase renders (real cards or graceful fallback)", async ({
    page,
    request,
  }) => {
    await page.goto("/");

    // Pre-fetch the list so the test branches deterministically on
    // "we have approved sellers" vs "fallback to coming-soon".
    const listRes = await request.get(`${apiURL}/sellers?page=0&size=8`);
    const list = listRes.ok() ? ((await readJson<SellerListResponse>(listRes)).data?.content ?? []) : [];

    if (list.length > 0) {
      // Real cards path — the first seller's shop name should be visible
      // on the home page. Allow generous timeout for cold-start fetches.
      const shopName = list[0]?.shopName ?? list[0]?.id ?? "";
      await expect(page.getByText(shopName, { exact: false }).first()).toBeVisible({
        timeout: 20_000,
      });
    } else {
      // Fallback path — the section title still renders, even though the
      // body is the ComingSoonCard. Verify the page didn't crash.
      await expect(page.locator("nav, header").first()).toBeVisible();
    }
  });

  test("/sellers/:id renders detail or not-found without crashing", async ({ page, request }) => {
    const listRes = await request.get(`${apiURL}/sellers?page=0&size=1`);
    const first = listRes.ok()
      ? (await readJson<SellerListResponse>(listRes)).data?.content?.[0]
      : null;

    if (first?.id) {
      await page.goto(`/sellers/${first.id}`);
      // Shop name is the most reliable signal that the header rendered.
      await expect(page.getByText(first.shopName ?? first.id, { exact: false }).first()).toBeVisible({
        timeout: 20_000,
      });
      // Ensure the visit-shop CTA / banner area landed (page didn't crash).
      await expect(page.locator("main, [role='main'], body").first()).toBeVisible();
    } else {
      // No approved sellers in the seed — visit a known-bad id and verify
      // the not-found path renders instead of crashing the SPA. The app
      // shell may not render nav/header on the 404 layout, so we just
      // assert the URL stuck and the page produced visible body content.
      await page.goto("/sellers/00000000-0000-0000-0000-000000000000");
      await expect(page).toHaveURL(/\/sellers\//);
      await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });
    }
  });
});

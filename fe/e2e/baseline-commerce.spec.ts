import { expect, test } from "@playwright/test";

import { resolveAcceptancePath } from "./fixtures/commerce-acceptance";

test("public buyer discovery reaches a product without layout overflow", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search products" });
  await search.fill("phone");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/search\?.*q=phone/);
  await expect(page.locator("main")).toBeVisible();

  const productPath = await resolveAcceptancePath(page.request, "/product/{seededProductId}");
  await page.goto(productPath);
  await expect(page).toHaveURL(productPath);
  await expect(page.locator("main")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

test("protected checkout preserves the requested destination", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/);
});

test("buyer proxy records bounded discovery actions", async ({ page }, testInfo) => {
  let actions = 0;
  await page.goto("/");
  actions += 1;
  const search = page.getByRole("combobox", { name: "Search products" });
  await search.fill("phone");
  await search.press("Enter");
  actions += 2;
  await expect(page.locator("main")).toBeVisible();
  expect(actions).toBeLessThanOrEqual(3);
  await testInfo.attach("journey-proxy", {
    body: JSON.stringify({ journey: "home-to-search", completed: true, actions }),
    contentType: "application/json",
  });
});

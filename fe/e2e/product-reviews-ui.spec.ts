import { expect, test } from "@playwright/test";

import { loginViaOidc } from "./_auth";
import { readJson, type ProductListResponse } from "./_api";

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const password = "Test1234!";

test("buyer can select a rating, submit a comment, and see live review totals", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const email = `e2e_review_${stamp}@vnshop.local`;
  const comment = `Review UI check ${stamp}`;

  const registration = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "Review", lastName: "Buyer", email, password },
  });
  expect(registration.ok(), `register failed: ${registration.status()}`).toBeTruthy();

  const productsResponse = await request.get(`${apiURL}/products?size=1`);
  expect(productsResponse.ok()).toBeTruthy();
  const product = (await readJson<ProductListResponse>(productsResponse)).data?.content?.[0];
  expect(product?.id).toBeTruthy();
  if (!product) throw new Error("expected a seeded product");

  const reviewsResponse = await request.get(`${apiURL}/reviews/product/${product.id}`);
  expect(reviewsResponse.ok()).toBeTruthy();
  const liveReviews = (await readJson<{ data?: { id?: string }[] }>(reviewsResponse)).data ?? [];

  await loginViaOidc(page, email, password);

  await page.goto(`/product/${product.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });

  const reviewsTab = page.getByRole("tab", { name: /^Reviews \(\d+\)$/ }).first();
  await reviewsTab.click();
  await expect(reviewsTab).toHaveText(`Reviews (${liveReviews.length})`);
  await expect(page.getByTestId("review-summary")).toContainText(String(liveReviews.length));

  const stars = page.getByRole("radio", { name: /^\d stars$/ });
  await expect(stars).toHaveCount(5);
  await expect(stars.nth(4)).toBeChecked();
  await stars.nth(2).click();
  await expect(stars.nth(2)).toBeChecked();
  await expect(stars.nth(3)).not.toBeChecked();

  const submit = page.getByRole("button", { name: /submit review/i });
  await expect(submit).toBeDisabled();
  await page.locator("textarea").fill(comment);
  await expect(submit).toBeEnabled();

  const post = page.waitForResponse(
    (response) => response.url().includes("/reviews") && response.request().method() === "POST",
  );
  await submit.click();
  const postResponse = await post;
  expect(postResponse.status()).toBe(201);
  expect(postResponse.request().postDataJSON()).toMatchObject({ rating: 3, comment });

  await expect(page.getByText(/review submitted/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(comment)).toBeVisible({ timeout: 15_000 });
});

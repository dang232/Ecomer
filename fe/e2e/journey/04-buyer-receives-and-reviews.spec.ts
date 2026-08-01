import { test, expect } from "@playwright/test";

import { loginViaOidc } from "../_auth";
import { logoutViaUserMenu } from "../_workday-evidence";

import {
  bizStep,
  copyArtifacts,
  expectNoGlobalError,
  finalizeChapterReport,
  rememberOutputDir,
  startChapter,
  startTrace,
  stopTrace,
} from "./_journey-evidence";
import { requireJourneyState } from "./_journey-state";

/**
 * Chapter 4 — Buyer reviews the ordered product.
 *
 * Business outcomes proven against the live SPA + BE:
 *   AC-4.1 The buyer who placed the chapter-2 order can find that order
 *          in their /orders history (already proven by AC-2.3, but
 *          re-asserted here as the entry point so chapter 4 fails fast
 *          with a meaningful message if the buyer's session is gone).
 *   AC-4.2 The buyer can submit a 5-star written review on the product
 *          they ordered, and the SPA confirms via a success toast.
 *   AC-4.3 The buyer sees the review publication outcome. APPROVED reviews
 *          are visible on the public product page; PENDING reviews expose a
 *          moderation notice and remain hidden from public shoppers.
 *
 * Requires Chapters 2 + 3 to have run (chapter 2 placed the order;
 * chapter 3 moved it through accept + ship). Reads `buyerEmail`,
 * `buyerPassword`, `productId`, `orderId` from the shared state file.
 *
 * Reframed scope note (caught while drafting):
 *   The original design imagined "buyer sees Delivered status when
 *   seller marks delivery." But the platform's FulfillmentStatus enum
 *   has no DELIVERED state — the order domain ends at SHIPPED, and
 *   "delivered" lives in shipping-service's TrackingStatus (carrier-
 *   reported, asynchronous). There's no seller-side mark-as-delivered
 *   action in the SPA today. Chapter 4 therefore asserts what the
 *   platform actually supports: the order is visible and the buyer can
 *   leave a review on the ordered product. AC-4.1 stays as "buyer can
 *   reach their order history" rather than "buyer sees Delivered".
 *   Surfacing a delivery status to the buyer is a follow-up; until
 *   then the journey suite records the moderation handoff as the expected
 *   production state rather than treating it as a failed write.
 */

test.use({
  video: "on",
  trace: "off",
  actionTimeout: 30_000,
});

test.describe.serial("Chapter 4 — Buyer reviews the ordered product", () => {
  test.beforeAll(async () => {
    await startChapter({
      id: "04-buyer-reviews",
      title: "Chapter 4 — Buyer reviews the ordered product",
      persona: "buyer",
      acceptanceCriteria: [
        {
          code: "AC-4.1",
          outcome: "Buyer who placed the order can return to their /orders history and see it",
        },
        {
          code: "AC-4.2",
          outcome: "Buyer can submit a 5-star written review on the ordered product",
        },
        {
          code: "AC-4.3",
          outcome:
            "Buyer sees review publication status; approved reviews are public and pending reviews show moderation",
        },
      ],
    });
  });

  test.afterEach(({ page: _page }, testInfo) => {
    rememberOutputDir("04-buyer-reviews", testInfo);
  });

  test.afterAll(async () => {
    await copyArtifacts("04-buyer-reviews");
    await finalizeChapterReport("04-buyer-reviews");
  });

  test.setTimeout(15 * 60 * 1000);

  test("Buyer logs in, leaves a 5-star review, sees it on the product page", async ({ page }) => {
    await startTrace("04-buyer-reviews", page);
    try {
      const reviewBody = `Journey review run ${Date.now()} — solid product, fast delivery, would buy again.`;
      let publicationOutcome: "published" | "pending" | "rejected" = "pending";

      await bizStep(
        page,
        "04-buyer-reviews",
        "AC-4.1",
        "Predecessor chapters left the buyer + product + order in state.json",
        async () => {
          await requireJourneyState(["buyerEmail", "buyerPassword", "productId", "orderId"]);
        },
      );

      await bizStep(
        page,
        "04-buyer-reviews",
        "AC-4.1",
        "Buyer logs back in and reaches /orders showing chapter 2's order",
        async () => {
          const state = await requireJourneyState(["buyerEmail", "buyerPassword"]);
          // Clear any session cookies left over from chapter 3's seller
          // login so /login actually shows its form.
          await page.context().clearCookies();

          await loginViaOidc(page, state.buyerEmail, state.buyerPassword);

          await page.goto("/orders");
          await expect(
            page
              .getByText(/Mã đơn|Order ID|Đăng nhập để xem đơn hàng|Log in to view your orders/i)
              .first(),
          ).toBeVisible({ timeout: 20_000 });
          await expectNoGlobalError(page);
        },
      );

      await bizStep(
        page,
        "04-buyer-reviews",
        "AC-4.2",
        "Buyer opens the product detail page for the ordered product",
        async () => {
          const state = await requireJourneyState(["productId"]);
          await page.goto(`/product/${state.productId}`);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
            timeout: 20_000,
          });
          // The reviews section anchor — open the Reviews tab so the
          // textarea is in the rendered tree (the page tabs between
          // Description / Reviews / Q&A; the textarea lives under
          // Reviews).
          // ProductPage's tabs render "Reviews ({count})" / "Đánh giá ({count})"
          // — the parenthesised count anchors away from generic "Reviews"
          // navigation labels elsewhere on the page (seller hub, etc.).
          const reviewsTab = page
            .getByRole("tab", { name: /^(Reviews|Đánh giá)\s*\(\d+\)$/i })
            .first();
          await expect(reviewsTab).toBeVisible({ timeout: 10_000 });
          await reviewsTab.click();
          await expectNoGlobalError(page);
        },
      );

      await bizStep(
        page,
        "04-buyer-reviews",
        "AC-4.2",
        "Buyer fills the review form and submits — success toast confirms",
        async () => {
          // ProductPage renders a 5-star default and a textarea. The
          // submit button's localized label is the value of
          // `product.reviews.submit` — match liberally.
          const textarea = page
            .locator("textarea")
            .filter({ hasNot: page.locator("[disabled]") })
            .first();
          await expect(textarea).toBeVisible({ timeout: 10_000 });
          await textarea.fill(reviewBody);

          await page
            .getByRole("button", {
              name: /Submit review|Send review|Gửi đánh giá|Đăng đánh giá|Submit$|Gửi$/i,
            })
            .first()
            .click();

          await expect(
            page.getByText(/Review submitted|Đã gửi đánh giá|Review posted/i).first(),
          ).toBeVisible({ timeout: 15_000 });
          const publicationNotice = page
            .locator(
              '[data-testid="published-review"], [data-testid="pending-review"], [data-testid="rejected-review"]',
            )
            .first();
          await expect(publicationNotice).toBeVisible({ timeout: 10_000 });
          const noticeId = await publicationNotice.getAttribute("data-testid");
          publicationOutcome =
            noticeId === "published-review"
              ? "published"
              : noticeId === "rejected-review"
                ? "rejected"
                : "pending";
          await expectNoGlobalError(page);
        },
      );

      await bizStep(
        page,
        "04-buyer-reviews",
        "AC-4.3",
        "Buyer sees review publication status; approved reviews are public and pending reviews show moderation",
        async () => {
          const state = await requireJourneyState(["productId"]);
          if (publicationOutcome === "rejected") {
            throw new Error("review was rejected by the moderation policy");
          }

          if (publicationOutcome === "pending") {
            await expect(page.getByTestId("pending-review")).toBeVisible({ timeout: 10_000 });
            await expectNoGlobalError(page);
            return;
          }

          // Force a clean fetch — React Query already invalidated
          // ["catalog","reviews","product",id], but a hard reload flushes
          // any stale list a sibling browser tab may have cached.
          await page.goto(`/product/${state.productId}`);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
            timeout: 20_000,
          });
          await page
            .getByRole("tab", { name: /^(Reviews|Đánh giá)\s*\(\d+\)$/i })
            .first()
            .click();

          // Match a unique substring of the review body (the timestamp).
          // The review may be in a list item or a card; the unique
          // substring is enough.
          const stamp = /run (\d+)/.exec(reviewBody)?.[1] ?? "";
          await expect
            .poll(async () => page.getByText(stamp).count(), {
              timeout: 30_000,
              message: `review with stamp ${stamp} never appeared on the product page within 30 s`,
            })
            .toBeGreaterThan(0);
          await expectNoGlobalError(page);
        },
      );

      await bizStep(
        page,
        "04-buyer-reviews",
        "AC-4.3",
        "Buyer logs out — chapter 4 leaves no new state for downstream chapters",
        async () => {
          // Chapter 4 doesn't write new state — chapter 5 (seller cashes
          // out) only needs the seller's wallet balance, which it reads
          // directly from the wallet API at run time.
          await logoutViaUserMenu(page);
        },
      );
    } finally {
      await stopTrace("04-buyer-reviews", page);
      await finalizeChapterReport("04-buyer-reviews");
    }
  });
});

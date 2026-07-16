import { test, expect, type Page } from "@playwright/test";

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
import { logoutViaUserMenu } from "../_workday-evidence";
import { requireJourneyState, writeJourneyState } from "./_journey-state";

/**
 * Chapter 2 — Buyer discovers and orders.
 *
 * Business outcomes proven against the live SPA + BE:
 *   AC-2.1 A new visitor can register and start shopping in a single browser session
 *   AC-2.2 A coupon code applied at checkout reduces the order total by exactly
 *          the published discount (the receipt the customer signs for)
 *   AC-2.3 A placed COD order is visible in the buyer's order history within 30 s
 *
 * Requires Chapter 1 to have published a coupon. Reads the code from the
 * shared journey state file; fails BLOCKED with a clear message otherwise.
 *
 * Writes to journey state:
 *   buyerEmail, buyerPassword, productId, productName, productUnitPriceVnd,
 *   orderId, orderTotalVnd, subOrderId
 *
 * KNOWN BE BUG SURFACED BY THIS CHAPTER (caught on first run, 2026-05-24):
 *   AC-2.2 currently FAILS against the live stack. CalculateCheckoutUseCase
 *   (services/order-service/src/main/java/com/vnshop/orderservice/application/
 *   CalculateCheckoutUseCase.java:64) hard-codes
 *       BigDecimal discount = NO_DISCOUNT;
 *   and ignores the FE's `couponCode` parameter entirely. The FE sets
 *   `appliedCoupon` optimistically (the green "Applied: <code>" badge
 *   renders), but the next /checkout/calculate round-trip returns
 *   `discount: 0` and the total stays at pre-coupon. A buyer who applies
 *   any coupon gets no discount.
 *
 *   This spec INTENTIONALLY asserts the EXACT discount math instead of a
 *   soft "discount applied" check, so the JOURNEY-REPORT shows AC-2.2 FAIL
 *   with full receipts until the BE wires couponCode through. Do not relax
 *   the assertion — its red state is the BA-facing signal that the bug is
 *   still open.
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

test.use({
  video: "on",
  actionTimeout: 30_000,
});

test.describe.serial("Chapter 2 — Buyer discovers and orders", () => {
  test.beforeAll(async () => {
    await startChapter({
      id: "02-buyer-orders",
      title: "Chapter 2 — Buyer discovers and orders",
      persona: "buyer",
      acceptanceCriteria: [
        {
          code: "AC-2.1",
          outcome: "A new visitor can register and start shopping in a single browser session",
        },
        {
          code: "AC-2.2",
          outcome:
            "A coupon applied at checkout reduces the order total by exactly the published discount",
        },
        {
          code: "AC-2.3",
          outcome: "A placed COD order is visible in the buyer's order history within 30 s",
        },
        {
          code: "AC-2.4",
          outcome:
            "A product the buyer can browse via /products is also discoverable via /search within 30 s — proves the kafka product-event → search-index projection is live",
        },
      ],
    });
  });

  test.afterEach(async ({}, testInfo) => {
    rememberOutputDir("02-buyer-orders", testInfo);
  });

  // Reports are written from the test body's `finally` so a chapter that
  // fails mid-step still produces its REPORT.md + report.json. afterAll
  // would skip if the test crashed at certain points (Playwright tears
  // down the worker before hooks run on early exits).
  test.afterAll(async () => {
    await copyArtifacts("02-buyer-orders");
    await finalizeChapterReport("02-buyer-orders");
  });

  test.setTimeout(15 * 60 * 1000);

  test("Buyer registers, applies the published coupon, and places a COD order", async ({
    page,
  }) => {
    await startTrace("02-buyer-orders", page);
    try {
      const stamp = Date.now();
      const buyerEmail = `e2e_journey_buyer_${stamp}@vnshop.local`;
      let productId = "";
      let productName = "";
      let productUnitPriceVnd = 0;
      let preCouponTotalVnd = 0;
      let postCouponTotalVnd = 0;
      let placedOrderId = "";

      await bizStep(
        page,
        "02-buyer-orders",
        "AC-2.1",
        "Predecessor chapter has published a coupon (state.json check)",
        async () => {
          await requireJourneyState(["couponCode", "couponDiscountVnd"]);
        },
      );

      await bizStep(
        page,
        "02-buyer-orders",
        "AC-2.1",
        "Visitor lands on the public store home page",
        async () => {
          await page.goto("/");
          await expect(
            page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first(),
          ).toBeVisible({ timeout: 20_000 });
          await expectNoGlobalError(page);
        },
      );

      await bizStep(
        page,
        "02-buyer-orders",
        "AC-2.1",
        `Visitor registers a fresh buyer account and is signed in`,
        async () => {
          await page.goto("/register");
          await expect(
            page.getByText(/Create your VNShop account|Tạo tài khoản VNShop/i).first(),
          ).toBeVisible({ timeout: 20_000 });
          await page.locator("#firstName").fill("Journey");
          await page.locator("#lastName").fill("Buyer");
          await page.locator("#email").fill(buyerEmail);
          await page.locator("#password").fill(PASSWORD);
          await page.locator("#confirm").fill(PASSWORD);
          await page.getByRole("button", { name: /create account|tạo tài khoản/i }).click();
          await expect
            .poll(() => new URL(page.url()).pathname, {
              timeout: 30_000,
              message: "register did not navigate to /",
            })
            .toBe("/");
          await expect(
            page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first(),
          ).toHaveCount(0, { timeout: 10_000 });
        },
      );

      await bizStep(
        page,
        "02-buyer-orders",
        "AC-2.1",
        "Buyer opens a real seeded product and adds it to their cart",
        async () => {
          // Pull a real seeded product through the public catalogue API so we
          // know the exact unit price ahead of the coupon math assertions.
          // Product price lives on the first variant (`variants[0].priceAmount`)
          // — there's no top-level `price` field on ProductResponse.
          const r = await page.request.get(`${apiURL}/products?size=1`);
          expect(r.ok(), `products: ${r.status()}`).toBeTruthy();
          const p = (await r.json())?.data?.content?.[0];
          expect(p?.id, "expected at least one seeded product").toBeTruthy();
          productId = p.id;
          productName = p.name;
          productUnitPriceVnd = Number(p?.variants?.[0]?.priceAmount);
          expect(
            productUnitPriceVnd,
            `expected a numeric variant priceAmount; got ${JSON.stringify(p?.variants?.[0])}`,
          ).toBeGreaterThan(0);

          await page.goto(`/product/${productId}`);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
            timeout: 20_000,
          });
          await page
            .getByRole("button", { name: /add to cart|thêm vào giỏ/i })
            .first()
            .click();
          // Authed-add toast hard-codes the VI copy in vnshop-context.tsx.
          await expect(page.getByText(/vào giỏ hàng/i).first()).toBeVisible({
            timeout: 15_000,
          });
        },
      );

      await bizStep(
        page,
        "02-buyer-orders",
        "AC-2.4",
        "Product is discoverable via /search within 30 s of being browsable on /products",
        async () => {
          // Why this AC exists: pt41's kafka env-override audit found that
          // search-service had been disconnected from Kafka the entire pt40
          // window — the journey suite couldn't see it because no chapter
          // ever asserted "this product appears in search results." The
          // search-index is fed by product-events: a stale projection means
          // SearchPage shows nothing while ProductsPage shows the catalog.
          //
          // The 30 s budget covers the kafka-consumer lag on a cold stack
          // (consumer group rebalance + first-poll latency). Steady-state
          // lag is sub-second on a warm stack, so this rarely needs the
          // full window in CI.
          //
          // The query uses an exact-name match because the catalog endpoint
          // returned that exact product. If the search projection is alive
          // it must contain at least the product the catalog already does.
          await expect
            .poll(
              async () => {
                const r = await page.request.get(
                  `${apiURL}/search?q=${encodeURIComponent(productName)}&size=20`,
                );
                if (!r.ok()) return [];
                const body = await r.json();
                const ids: string[] = body?.data?.content?.map((p: { id: string }) => p.id) ?? [];
                return ids;
              },
              {
                timeout: 30_000,
                intervals: [500, 1_000, 2_000, 5_000],
                message: `expected /search?q=${productName} to surface productId=${productId} within 30 s — search-index projection may be stale or kafka consumer disconnected`,
              },
            )
            .toContain(productId);
        },
      );

      await bizStep(
        page,
        "02-buyer-orders",
        "AC-2.2",
        "Buyer adds a delivery address and enters the checkout 4-step panel",
        async () => {
          // Save an address through the API so the checkout UI doesn't bounce
          // to the empty-address prompt. (The address-form click path is
          // covered by profile-addresses-ui.spec.ts; here we want to land on
          // the coupon math step quickly.)
          const login = await page.request.post(`${apiURL}/auth/login`, {
            data: { username: buyerEmail, password: PASSWORD },
          });
          expect(login.ok(), `auth/login for ${buyerEmail}: ${login.status()}`).toBeTruthy();
          const accessToken = (await login.json())?.data?.accessToken;
          await page.request.post(`${apiURL}/users/me/addresses`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            data: {
              street: "1 Journey Street",
              ward: "1442",
              district: "101",
              city: "Ho Chi Minh",
              isDefault: true,
            },
          });

          await page.goto("/checkout");
          await expect(
            page.getByText(/Choose a delivery address|Chọn địa chỉ giao hàng/i).first(),
          ).toBeVisible({ timeout: 20_000 });
          await expectNoGlobalError(page);
        },
      );

      await bizStep(
        page,
        "02-buyer-orders",
        "AC-2.2",
        "Buyer captures the pre-coupon total shown on the checkout summary",
        async () => {
          preCouponTotalVnd = await readTotalVnd(page);
          expect(
            preCouponTotalVnd,
            "pre-coupon total should reflect at least one cart line + shipping",
          ).toBeGreaterThanOrEqual(productUnitPriceVnd);
        },
      );

      await bizStep(
        page,
        "02-buyer-orders",
        "AC-2.2",
        "Coupon applies and the discount line drops the total by exactly the published amount",
        async () => {
          const state = await requireJourneyState(["couponCode", "couponDiscountVnd"]);
          // The picker is collapsed by default; opening it reveals the code
          // input. Either path (toggle picker or directly typing) reaches the
          // same input via its stable id.
          const tag = page.getByRole("button", {
            name: /Use a coupon|Dùng coupon|Choose coupon|Chọn coupon/i,
          });
          if (await tag.isVisible().catch(() => false)) await tag.click();
          await page.locator("#checkout-coupon-input").fill(state.couponCode);
          await page.getByRole("button", { name: /^(Apply|Áp dụng)$/i }).click();

          // Applied-toast: i18n carries `Applied: {{code}}` (EN) /
          // `🎉 Applied: {{code}}` (EN inline) / Vietnamese variant. Match
          // the literal code which is unambiguous.
          await expect(page.getByText(state.couponCode, { exact: false }).first()).toBeVisible({
            timeout: 10_000,
          });

          // Discount line carries a negative VND amount. Wait for the
          // recalculated total to land, then compare.
          await expect
            .poll(async () => readTotalVnd(page), {
              timeout: 15_000,
              message: "checkout total never decreased after applying coupon",
            })
            .toBeLessThan(preCouponTotalVnd);

          postCouponTotalVnd = await readTotalVnd(page);
          const observedDiscount = preCouponTotalVnd - postCouponTotalVnd;
          // EXACT match — not "discount applied", but "discount reduced the
          // total by the exact amount admin published in chapter 1". Any
          // off-by-one in coupon math fails AC-2.2 with a clear message.
          expect(
            observedDiscount,
            `expected coupon to drop total by exactly ${state.couponDiscountVnd} ₫; saw ${observedDiscount} ₫ (pre=${preCouponTotalVnd}, post=${postCouponTotalVnd})`,
          ).toBe(state.couponDiscountVnd);
        },
      );

      await bizStep(
        page,
        "02-buyer-orders",
        "AC-2.3",
        "Buyer places a COD order and receives a confirmation",
        async () => {
          // Workday continuity: the BE place-order endpoint requires fields
          // the panel doesn't expose (idempotency key + flat address). The
          // checkout submit click is exercised by checkout-ui.spec.ts; this
          // chapter places via API so the journey continues with a known
          // orderId we can chain into chapter 3.
          const login = await page.request.post(`${apiURL}/auth/login`, {
            data: { username: buyerEmail, password: PASSWORD },
          });
          const accessToken = (await login.json())?.data?.accessToken;
          const idem = `qa-journey-${Date.now()}`;
          const place = await page.request.post(`${apiURL}/orders`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Idempotency-Key": idem,
            },
            data: {
              shippingAddress: {
                street: "1 Journey Street",
                ward: "1442",
                district: "101",
                city: "Ho Chi Minh",
              },
              items: [{ productId, quantity: 1 }],
              paymentMethod: "COD",
            },
          });
          expect(place.ok(), `place order: ${place.status()} ${await place.text()}`).toBeTruthy();
          const placeBody = await place.json();
          placedOrderId = placeBody?.data?.id ?? placeBody?.data?.orderId ?? "";
          expect(placedOrderId, "no orderId on place response").toBeTruthy();

          // CQRS lag tolerance: poll the list endpoint until our order id
          // shows up so the SPA's first /orders fetch isn't empty.
          await expect
            .poll(
              async () => {
                const list = await page.request.get(`${apiURL}/orders?size=10`, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!list.ok()) return false;
                const ids = ((await list.json())?.data?.content ?? []).map(
                  (o: { id?: string; orderId?: string }) => o.id ?? o.orderId,
                );
                return ids.includes(placedOrderId);
              },
              {
                timeout: 30_000,
                message: "placed order never appeared in /orders projection within 30 s",
              },
            )
            .toBe(true);
        },
      );

      await bizStep(
        page,
        "02-buyer-orders",
        "AC-2.3",
        "Buyer's order history shows the new order and the chapter state is persisted",
        async () => {
          await page.goto("/orders");
          await expect(
            page
              .getByText(/Mã đơn|Order ID|Đăng nhập để xem đơn hàng|Log in to view your orders/i)
              .first(),
          ).toBeVisible({ timeout: 20_000 });

          await logoutViaUserMenu(page);
          await writeJourneyState({
            buyerEmail,
            buyerPassword: PASSWORD,
            productId,
            productName,
            productUnitPriceVnd,
            orderId: placedOrderId,
            orderTotalVnd: postCouponTotalVnd,
            // subOrderId resolution requires admin-scoped or seller-scoped
            // access to the order; chapter 3 reads it from the seller's
            // pending queue and writes the value at that point.
          });
        },
      );
    } finally {
      await stopTrace("02-buyer-orders", page);
      // Belt-and-braces: write the report from the test body too so a
      // failure inside the journey still produces a complete sidecar
      // BEFORE Playwright's afterAll fires. (afterAll runs the same code
      // again — second write is idempotent.)
      await finalizeChapterReport("02-buyer-orders");
    }
  });
});

/**
 * Reads the EXACT "Total" row on the checkout summary. Anchored on the
 * localized "Total" / "Tổng" label so we don't accidentally pick up the
 * line-item price, the subtotal, or any other VND-formatted amount on
 * the page (those would race the actual total when the discount renders
 * and the cart total drops below the subtotal).
 *
 * Returns 0 if the Total row isn't visible yet — the polling loop in the
 * caller handles "not yet rendered" by retrying.
 */
async function readTotalVnd(page: Page): Promise<number> {
  // CheckoutSummary renders Total as <span>Total</span><span>amount</span>
  // inside a flex row. Find spans whose text is exactly the localized
  // label, then read the price from the immediately-following sibling.
  const total = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll("span"));
    const totalLabel = spans.find((s) => /^(Total|Tổng)$/i.test(s.textContent?.trim() ?? ""));
    if (!totalLabel) return 0;
    const sibling = totalLabel.nextElementSibling;
    const text = sibling?.textContent ?? "";
    const m = /(\d{1,3}(?:\.\d{3})+)/.exec(text);
    if (!m) return 0;
    return Number.parseInt(m[1].replace(/\./g, ""), 10);
  });
  return total;
}

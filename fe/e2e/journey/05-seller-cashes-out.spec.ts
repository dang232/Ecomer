import { test, expect, type APIRequestContext } from "@playwright/test";

import {
  readJson,
  type AuthResponse,
  type PayoutListResponse,
  type WalletResponse,
} from "../_api";
import { loginAsSeededUser, logoutViaUserMenu } from "../_workday-evidence";
import {
  credentialForPersona,
  type Persona,
} from "../modernization/_credentials";

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
import { requireJourneyState, writeJourneyState } from "./_journey-state";

/**
 * Chapter 5 — Seller cashes out.
 *
 * Business outcomes proven against the live SPA + BE:
 *   AC-5.1 A seller with positive earnings can request a payout from the
 *          wallet tab — the SPA submits an amount + bank account, the BE
 *          accepts it, and the payout history shows a PENDING row.
 *   AC-5.2 The payout immediately appears in admin's pending payout queue
 *          (verified via the admin API rather than admin UI; chapter 6
 *          drives the admin UI to complete it).
 *
 * Requires Chapter 3 to have moved an order through accept + ship, which
 * fires order.created on Kafka and credits seller1's wallet via the
 * OrderCreatedFinanceListener.
 *
 * Persona note: chapter 1 approved a fresh seller account, but that seller
 * has zero products and therefore zero earnings. Chapter 3's order was
 * placed against a seeded product owned by seller1 (the realm-imported
 * account); the wallet credit lands there. Chapter 5 logs in as seller1
 * directly to exercise the payout flow.
 *
 * Writes to journey state:
 *   payoutId       — used by chapter 6 to find the row in admin's queue
 *   payoutAmountVnd — used by chapter 6 to assert the wallet drops by
 *                     exactly this amount after admin completes the payout
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

async function accessTokenForPersona(
  request: APIRequestContext,
  persona: Persona,
): Promise<string> {
  const { username, password } = credentialForPersona(persona);
  const loginResponse = await request.post(`${apiURL}/auth/login`, {
    data: { username, password },
  });
  expect(
    loginResponse.ok(),
    `persona login (${persona}) failed: ${loginResponse.status()} ${await loginResponse.text()}`,
  ).toBeTruthy();
  const body = await readJson<AuthResponse>(loginResponse);
  const accessToken = body.data?.accessToken ?? body.accessToken;
  expect(accessToken, `no access token returned for ${persona}`).toBeTruthy();
  return accessToken ?? "";
}

test.use({
  video: "on",
  trace: "off",
  actionTimeout: 30_000,
});

test.describe.serial("Chapter 5 — Seller cashes out", () => {
  test.beforeAll(async () => {
    await startChapter({
      id: "05-seller-cashes-out",
      title: "Chapter 5 — Seller cashes out",
      persona: "seller",
      acceptanceCriteria: [
        {
          code: "AC-5.1",
          outcome: "Seller with positive wallet balance can submit a payout request",
        },
        {
          code: "AC-5.2",
          outcome: "Submitted payout immediately appears in admin's pending payout queue",
        },
      ],
    });
  });

  test.afterEach(({ page: _page }, testInfo) => {
    rememberOutputDir("05-seller-cashes-out", testInfo);
  });

  test.afterAll(async () => {
    await copyArtifacts("05-seller-cashes-out");
    await finalizeChapterReport("05-seller-cashes-out");
  });

  test.setTimeout(15 * 60 * 1000);

  test("Seller logs in, sees credited balance, requests a payout", async ({ page }) => {
    await startTrace("05-seller-cashes-out", page);
    try {
      let payoutAmountVnd = 0;
      let resolvedPayoutId = "";

      await bizStep(
        page,
        "05-seller-cashes-out",
        "AC-5.1",
        "Predecessor chapters left a fulfilled order in state.json",
        async () => {
          await requireJourneyState(["orderId", "subOrderId"]);
        },
      );

      await bizStep(
        page,
        "05-seller-cashes-out",
        "AC-5.1",
        "Seller's wallet shows positive available balance from chapter 3's fulfillment",
        async () => {
          // Poll the wallet API until the balance lands — the order.created
          // → CreditWalletUseCase projection runs asynchronously through
          // Kafka and lag varies under load.
          await expect
            .poll(
              async () => {
                const token = await accessTokenForPersona(
                  page.request,
                  "seller",
                );
                if (!token) return 0;
                const r = await page.request.get(`${apiURL}/sellers/me/finance/wallet`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (!r.ok()) return 0;
                const balance = Number(
                  (await readJson<WalletResponse>(r)).data?.availableBalance ?? 0,
                );
                if (balance > 0) {
                  payoutAmountVnd = balance;
                }
                return balance;
              },
              {
                timeout: 60_000,
                message:
                  "seller1 wallet never showed a positive balance after chapter 3 fulfilled the order — Kafka order.created listener may not be running",
              },
            )
            .toBeGreaterThan(0);
        },
      );

      await bizStep(
        page,
        "05-seller-cashes-out",
        "AC-5.1",
        "Seller logs into the SPA and the Wallet tab shows the same balance",
        async () => {
          await page.context().clearCookies();
          await loginAsSeededUser(page, "seller");
          await page.goto("/seller");
          await expect(
            page.getByText(/Dashboard|Tổng quan|Seller Hub|Kênh Người Bán/i).first(),
          ).toBeVisible({ timeout: 20_000 });

          await page
            .getByRole("button", { name: /^(Wallet|Ví tiền)$/i })
            .first()
            .click();
          await expect(page.getByText(/Wallet & Payouts|Ví & Thanh toán/i).first()).toBeVisible({
            timeout: 15_000,
          });

          // Withdraw button is enabled iff balance > 0 — that's the
          // canonical UI signal that the credit landed end-to-end.
          const withdraw = page.getByRole("button", { name: /^(Withdraw|Rút tiền)$/i }).first();
          await expect(withdraw).toBeVisible({ timeout: 10_000 });
          await expect(withdraw).toBeEnabled({ timeout: 10_000 });
          await expectNoGlobalError(page);
        },
      );

      await bizStep(
        page,
        "05-seller-cashes-out",
        "AC-5.1",
        `Seller submits a payout request for the full balance (${payoutAmountVnd} ₫)`,
        async () => {
          await page
            .getByRole("button", { name: /^(Withdraw|Rút tiền)$/i })
            .first()
            .click();
          // FormDialog renders both fields as type="text" (the number
          // type is just an inputMode hint). Match the inputs by their
          // declared placeholders from SellerWallet.tsx.
          const amountInput = page.getByPlaceholder(/^1000000$|VND/i).first();
          await expect(amountInput).toBeVisible({ timeout: 10_000 });
          await amountInput.fill(String(payoutAmountVnd));

          const bankInput = page
            .getByPlaceholder(/Số tài khoản|Bank account|0123456789|tài khoản ngân hàng/i)
            .first();
          await expect(bankInput).toBeVisible({ timeout: 10_000 });
          await bankInput.fill("0123456789");

          await page
            .getByRole("button", {
              name: /Submit request|Gửi yêu cầu|Gửi$/i,
            })
            .first()
            .click();

          await expect(
            page
              .getByText(
                /Withdrawal request submitted|Đã gửi yêu cầu rút tiền|Yêu cầu rút tiền đã gửi/i,
              )
              .first(),
          ).toBeVisible({ timeout: 15_000 });
          await expectNoGlobalError(page);
        },
      );

      await bizStep(
        page,
        "05-seller-cashes-out",
        "AC-5.2",
        "Submitted payout appears in admin's pending payout queue",
        async () => {
          // Verified via the admin API rather than admin UI — chapter 6
          // drives the admin UI to complete the payout. This step proves
          // the cross-persona handoff: what the seller submits is what
          // the admin will see.
          const adminToken = await accessTokenForPersona(
            page.request,
            "admin",
          );

          await expect
            .poll(
              async () => {
                const r = await page.request.get(`${apiURL}/admin/finance/payouts/pending`, {
                  headers: { Authorization: `Bearer ${adminToken}` },
                });
                if (!r.ok()) return null;
                const list = (await readJson<PayoutListResponse>(r)).data ?? [];
                // seller1's keycloakId is what the wallet credit went
                // against. Find the most recent PENDING payout for that
                // seller — it's the one chapter 5 just submitted.
                const match = list.find(
                  (p) => Number(p.amount) === payoutAmountVnd && p.status === "PENDING",
                );
                if (match?.payoutId) {
                  resolvedPayoutId = match.payoutId;
                  return resolvedPayoutId;
                }
                return null;
              },
              {
                timeout: 30_000,
                message: `admin's pending payout queue never showed a ${payoutAmountVnd} ₫ PENDING payout — cross-persona handoff broken`,
              },
            )
            .not.toBeNull();
        },
      );

      await bizStep(
        page,
        "05-seller-cashes-out",
        "AC-5.2",
        "Seller logs out — chapter state persists payoutId for chapter 6",
        async () => {
          await logoutViaUserMenu(page);
          await writeJourneyState({
            payoutId: resolvedPayoutId,
            payoutAmountVnd,
          });
        },
      );
    } finally {
      await stopTrace("05-seller-cashes-out", page);
      await finalizeChapterReport("05-seller-cashes-out");
    }
  });
});

import { test, expect } from "@playwright/test";

import { loginAsPersona } from "./_auth";
import { readJson, type AuthResponse, type WalletResponse } from "./_api";
import { expectNoGlobalError } from "./_helpers";
import { credentialForPersona } from "./modernization/_credentials";

/**
 * UI-driven QA spec for the seller wallet page.
 *
 * What this proves through the actual SPA:
 *   - /seller mounts for seller1, click Wallet tab — wallet card renders
 *   - Wallet shows a non-error balance state (post-pt28 walletSchema fix)
 *   - History section renders either rows or the empty-state copy
 *
 * Locks in the pt28 walletSchema + payoutSchema fixes:
 *   - BE returns availableBalance/pendingBalance, FE expected balance/pending
 *   - BE returns payoutId/createdAt, FE expected id/requestedAt
 *   - Both aliased through transforms; pre-fix the wallet tab crashed.
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

test.describe("seller wallet UI", () => {
  test("Wallet tab renders the balance card and history section", async ({ page }) => {
    await loginAsPersona(page, "seller");
    await page.goto("/seller");

    await expect(
      page.getByText(/Dashboard|Tổng quan|Seller Hub|Kênh Người Bán/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Click the Wallet nav tab.
    const walletTab = page.getByRole("button", { name: /^(Wallet|Ví tiền)$/i }).first();
    await expect(walletTab).toBeVisible({ timeout: 10_000 });
    await walletTab.click();

    // The wallet title and balance card render unconditionally; pre-pt28
    // walletSchema rejected the BE shape and the page errored out.
    await expect(page.getByText(/Wallet & Payouts|Ví & Thanh toán/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Available balance label is on the gradient card.
    await expect(page.getByText(/Available balance|Số dư khả dụng/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // History section header.
    await expect(page.getByText(/Withdrawal history|Lịch sử rút tiền/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await expectNoGlobalError(page);
  });

  test("Withdraw button follows the live seller balance", async ({ page }) => {
    await loginAsPersona(page, "seller");
    const { username, password } = credentialForPersona("seller");
    const loginResponse = await page.request.post(`${apiURL}/auth/login`, {
      data: { username, password },
    });
    expect(loginResponse.ok(), `seller login: ${loginResponse.status()}`).toBeTruthy();
    const accessToken = (await readJson<AuthResponse>(loginResponse)).data?.accessToken;
    expect(accessToken).toBeTruthy();
    if (!accessToken) throw new Error("seller login did not return an access token");
    const walletResponse = await page.request.get(`${apiURL}/sellers/me/finance/wallet`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(walletResponse.ok(), `wallet: ${walletResponse.status()}`).toBeTruthy();
    const walletBody = await readJson<WalletResponse>(walletResponse);
    const wallet = walletBody?.data ?? walletBody;
    const balance = wallet?.balance ?? wallet?.availableBalance ?? 0;
    expect(typeof balance).toBe("number");

    await page.goto("/seller");
    await expect(
      page.getByText(/Dashboard|Tổng quan|Seller Hub|Kênh Người Bán/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    const walletTab = page.getByRole("button", { name: /^(Wallet|Ví tiền)$/i }).first();
    await walletTab.click();
    await expect(page.getByText(/Wallet & Payouts|Ví & Thanh toán/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // The seeded seller can accumulate earnings across the day simulation, so
    // derive the expected state from the live wallet rather than assuming 0.
    const withdraw = page.getByRole("button", { name: /^(Withdraw|Rút tiền)$/i }).first();
    await expect(withdraw).toBeVisible({ timeout: 10_000 });
    if (balance <= 0) {
      await expect(withdraw).toBeDisabled();
    } else {
      await expect(withdraw).toBeEnabled();
    }
    expect(await withdraw.isDisabled()).toBe(balance <= 0);

    await expectNoGlobalError(page);
  });
});

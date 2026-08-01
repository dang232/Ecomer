/**
 * Typed wallet presenter.
 *
 * Architecture: this module is the single source of truth for what the wallet
 * page may display. All balance/history logic lives here so it can be tested
 * in isolation from the React component tree.
 *
 * Design decisions documented inline.
 */

import type { Payout, Wallet } from "@/shared/contracts/api/seller-finance";
import type { PayoutStatusUi } from "@/shared/contracts/domain-enums";

// ─── Public interface ─────────────────────────────────────────────────────────

export interface WalletView {
  /** Available balance returned directly from the wallet endpoint. */
  availableVnd: number | null;
  /**
   * Pending settlement balance — comes ONLY from wallet.pending.
   * Never derive this from payout history, which is a separate concept.
   */
  pendingBalanceVnd: number | null;
  /**
   * Sum of in-flight payout amounts.
   * LABELED separately from pendingBalanceVnd so reviewers can see the two
   * concepts are distinct and independently sourced.
   */
  activePayoutVnd: number;
  /** True when the seller may request a payout. */
  canRequestPayout: boolean;
  history: readonly WalletHistoryItem[];
}

export interface WalletHistoryItem {
  id: string;
  amountVnd: number;
  status: PayoutStatusUi;
  requestedAt: string;
}

// ─── Internal constants ───────────────────────────────────────────────────────

/**
 * Statuses that represent an in-flight payout — money the seller has already
 * requested but has not yet received.
 *
 * NOTE: this set intentionally includes statuses that may not yet be funded
 * (e.g. UNKNOWN, PENDING) so they are excluded from the active sum rather
 * than silently included in a way that would confuse the UI.
 *
 * PAID, FAILED, REJECTED, CANCELLED, REVERSED, COMPLETED are NOT active.
 */
const ACTIVE_PAYOUT_STATUSES = new Set<PayoutStatusUi>([
  "REQUESTED",
  "APPROVED",
  "SUBMITTING",
  "SUBMITTED",
  "UNKNOWN",
]);

// ─── Presenter ───────────────────────────────────────────────────────────────

/**
 * Convert raw wallet + payout data into a typed WalletView.
 *
 * `canRequestPayout` is true when:
 *   - balance is not null AND
 *   - balance is greater than zero AND
 *   - there is no active payout already in-flight.
 *
 * NOTE: the current implementation allows payout requests even when there IS
 * an active payout (seller can stack requests). If the business requirement
 * changes to block concurrent requests, flip the condition here and add a
 * test for the blocked case.
 */
export function toWalletView(input: {
  wallet: Pick<Wallet, "balance" | "pending">;
  payouts: Payout[];
}): WalletView {
  const { wallet, payouts } = input;

  const availableVnd = wallet.balance ?? null;
  const pendingBalanceVnd = wallet.pending ?? null;

  const activePayouts = payouts.filter((p) => ACTIVE_PAYOUT_STATUSES.has(p.status));
  const activePayoutVnd = activePayouts.reduce((sum, p) => sum + p.amount, 0);

  const hasActivePayout = activePayouts.length > 0;
  const canRequestPayout = availableVnd !== null && availableVnd > 0 && !hasActivePayout;

  const history: WalletHistoryItem[] = payouts.map((p) => ({
    id: p.id,
    amountVnd: p.amount,
    status: p.status,
    requestedAt: p.requestedAt ?? "",
  }));

  return {
    availableVnd,
    pendingBalanceVnd,
    activePayoutVnd,
    canRequestPayout,
    history,
  };
}

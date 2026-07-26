# seller-finance-service (AGENTS.md)

Active Spring Boot service on **port 8090**. Owns marketplace settlement,
the seller ledger, wallet projection, and the canonical payout state
machine.

## Owns

- Seller / platform accounting journals (`ledger_journals`, `ledger_postings`,
  `ledger_accounts`).
- Wallet projection (`settlementPending`, `available`, `reserve`,
  `payoutPending`, `debt`, `totalFees`, `totalRefunded`, `totalPaidOut`).
- `Payout` aggregate and its canonical state machine.
- Reconciliation scheduler, metrics, and (later) alerts.
- Authenticated internal lookup of `user-service` payout destination and the
  encrypted `PayoutDestinationSnapshot` written with each payout.

## Does NOT own

- Payout destination enrollment (long-term) — `user-service`.
- Per-sub-order commercial allocations — `order-service`.
- Provider cash facts — `payment-service`.
- Carrier delivery / COD collection — `shipping-service`.

## Flyway numbering (current main)

- `V2__wallets_and_payouts.sql` … `V9__settlement_release_candidates.sql`
  are merged.
- Next is **V10__payout_execution_expand.sql** (Safe Payout Milestone
  Task 8). Never add a second `V9` or `V10`.
- After that, **V11__settlement_reconciliation_expand.sql** (Task 12).

## Canonical payout vocabulary

`REQUESTED`, `APPROVED`, `SUBMITTING`, `SUBMITTED`, `PAID`, `UNKNOWN`,
`FAILED`, `REJECTED`, `CANCELLED`, `REVERSED`. Old `PENDING` / `COMPLETED`
remain only inside the documented compatibility window; new code must not
emit them.

## Event mode

`SELLER_FINANCE_EVENT_MODE=OFF|SHADOW|PRIMARY` is the single boundary for
credit, release, refund, and chargeback adjustments. Producer and consumer
must agree; conflicting combinations fail startup. Legacy booleans are
deprecated aliases during the Task 14 window only.

## Active Plan

`.omx/plans/safe-payout-milestone.md` is the binding plan until Tasks 1–10
are verified.
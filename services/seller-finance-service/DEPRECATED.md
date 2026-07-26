# seller-finance-service — Active Service

This service is the **active** owner of marketplace settlement, the seller
ledger, wallet projection, and payouts (port 8090).

## Service Boundaries (current, post Safe Payout Milestone)

| Concern | Owner |
|---|---|
| Seller payout destination enrollment (masked) | `user-service` |
| Per-sub-order immutable commercial allocations | `order-service` |
| Provider cash facts (capture / refund / chargeback) | `payment-service` |
| Verified carrier delivery / COD collection | `shipping-service` |
| **Settlement ledger, wallet projection, payout state machine, payout execution** | **`seller-finance-service` (this service)** |

`order-service` publishes versioned `seller.finance.adjustment` events; it does
**not** own payout execution and does **not** carry the seller money ledger.

## Finance Snapshot Ownership

When a payout is requested, `seller-finance-service` fetches the verified
destination through an authenticated internal contract and stores an
**encrypted, immutable** execution snapshot. The plaintext destination value
never crosses a public API boundary and is never serialized into seller/admin
browser responses.

## Migration Numbering (current main)

- Next migration (Safe Payout Milestone Task 8): `V10__payout_execution_expand.sql`
- Followed by (Task 12 reconciliation): `V11__settlement_reconciliation_expand.sql`

## Compatibility Window

Legacy listeners, gateway routes, and `realizedRevenue` / `pending` /
`completed` payout aliases remain in service only for the Task 14 retirement
window. New web flows and any approval / submission / payment action use the
canonical payout vocabulary (`REQUESTED`, `APPROVED`, `SUBMITTING`,
`SUBMITTED`, `PAID`, `UNKNOWN`, `FAILED`, `REJECTED`, `CANCELLED`, `REVERSED`)
and the new maker-checker + evidence controls. Legacy aliases never bypass
those controls.

## See Also

- `AGENTS.md` — minimal service-specific guidance for agentic workers.
- `.omx/plans/safe-payout-milestone.md` — the active milestone that locks
  this boundary.
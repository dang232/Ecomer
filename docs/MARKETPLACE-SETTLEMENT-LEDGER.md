# Marketplace Settlement Ledger Policy

## Purpose

This policy defines the finance boundary for the marketplace-settlement migration. Later schema, event, ledger, payout, and UI changes must follow it.

## Service Ownership

| Service | Owns | Does not own |
|---|---|---|
| `payment-service` | Provider capture, refund, and chargeback facts | Seller balances, journals, and payouts |
| `shipping-service` | Verified delivery and COD collection facts | Payment-provider settlement and seller accounting |
| `order-service` | Immutable per-sub-order commercial allocation | Payment-provider truth, seller accounting, and payouts |
| `seller-finance-service` | Seller and platform accounting, reserves, and payouts | Provider capture/refund/chargeback truth and carrier delivery truth |

No service may recreate or overwrite another service's facts. Services exchange immutable facts and derive their own projections.

## Monetary and Commercial Terms

Every monetary value is a `BigDecimal` plus an ISO currency code. Do not use binary floating-point amounts, currency-less amounts, or cross-currency arithmetic.

`order-service` freezes the commercial allocation for each sub-order. The allocation contains item GMV, seller-funded discount, seller shipping payable, seller tax payable, and the commission rate that applied when the order was accepted. It is immutable after publication; corrections create a new business fact rather than rewriting the allocation.

```text
commissionBase =
    itemGmvAmount - sellerFundedDiscountAmount

platformCommissionAmount =
    commissionBase * frozenCommissionRate

sellerPayableAmount =
    itemGmvAmount
  - sellerFundedDiscountAmount
  + sellerShippingPayableAmount
  + sellerTaxPayableAmount
  - platformCommissionAmount
```

Each term in an allocation and each calculated output carries the same currency.

## Settlement Rules

1. `order.created` records commercial intent only. It must never create seller money, a seller-finance journal, or payout eligibility.
2. A prepaid order becomes financially eligible only from a verified provider capture fact from `payment-service` and the applicable fulfillment-release fact.
3. A COD order becomes financially eligible only after `shipping-service` publishes verified COD collection. Delivery alone, an order status change, a carrier label, or buyer confirmation is not collection truth.
4. `seller-finance-service` posts the seller payable only from the required verified facts. It calculates the payable from the frozen commercial allocation, not from a mutable order total or a wallet balance.
5. Posted journals and postings are append-only. Refunds, chargebacks, reserves, corrections, and reversals create compensating postings; they do not update or delete posted history. Every correction or reversal links its original journal and posting identifiers and the source-fact reference that required it.

## Refunds, Chargebacks, and Reserves

`payment-service` is authoritative for provider refunds and chargebacks. On a verified fact, `seller-finance-service` posts the required compensating journal. A refund or chargeback must not silently clamp a seller balance to zero or mutate an earlier posting.

`seller-finance-service` may place a documented reserve or hold before payout. A reserve is an explicit ledger state with an amount, currency, reason, source fact, and release or reversal posting. It is not an implicit deduction.

## Payouts and Bank Data

A payout can use only funds that are posted, available, and not reserved. It has a stable idempotency key that is retained across retries. Duplicate delivery returns the prior result; an invalid or unknown event schema creates no posting, payout, idempotency mutation, or replacement key.

Raw bank account numbers and account-holder data must never be stored in plaintext in seller-finance storage or exposed through public APIs, logs, metrics, browser state, screenshots, or E2E evidence. Store destination data only in encrypted or otherwise protected seller-finance storage, and use masked values everywhere outside controlled payout integrations. Finance events, APIs, logs, audit views, support exports, and release evidence must use masked destinations only. Production configuration must fail closed when a required provider, payout, encryption, or destination-masking setting is absent or invalid.

## Event Handling

Event consumers validate the schema before they mutate any state. They use a stable, source-derived idempotency key only after the event is recognized as valid. A missing source event ID, missing source idempotency ID, or unknown major schema version goes to a diagnosable retry/DLT path with no journal, posting, payout, idempotency, replacement-key, or other financial mutation. Invalid payloads, missing required financial fields, and currency mismatches follow the same no-mutation rule.

## Settlement Legacy API Compatibility

The compatibility window covers the legacy seller wallet and payout APIs: `GET /sellers/me/finance/wallet`, `GET /sellers/me/finance/payouts`, and `POST /sellers/me/finance/payouts`; and the legacy admin payout queue and decision APIs: `GET /admin/finance/payouts/pending`, `GET /admin/finance/payouts/completed`, `POST /admin/finance/payouts/{payoutId}/complete`, and `POST /admin/finance/payouts/{payoutId}/fail`.

New web flows use versioned settlement APIs now and must not introduce new legacy calls. The legacy contract remains only through the settlement release and the required financial-record retention period. It may sunset only after the migration release is complete, retained ledger and payout records remain accessible for their required retention period, and two subsequent stable releases show no legacy API use. After expiry, the legacy paths fail closed: they reject requests without a fallback payment, payout, journal, or state mutation.

## Task 14 Stale-Documentation Cleanup

The following historical documentation remains outside Task 1 and must be reconciled with this policy in Task 14: `README.md`, `Architech.md`, `docs/ADMIN-DASHBOARD-DATA-FLOW-FINDINGS.md`, `docs/PRODUCTION-READINESS-REVIEW.md`, `docs/audit/02-business-logic-failures.md`, the finance-related `docs/SESSION-HANDOVER-*.md` records, `docs/COMPREHENSIVE-AUDIT-2026-07-10.md`, `docs/CROSS-VALIDATION-REPORT-2026-07-10.md`, `docs/SESSION-HANDOVER-AUDIT-2026-07-10.md`, `docs/GAP-ANALYSIS.md`, and `infra/service-split-assessment.md`. These records may retain `realizedRevenue`, `order.created` credit, clamped-balance, or deprecated-service statements that are not the settlement contract.

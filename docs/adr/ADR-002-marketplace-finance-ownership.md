# ADR-002: Marketplace Finance Ownership

## Status

Accepted — 2026-07-24

## Context

Marketplace finance requires independent provider, delivery, commercial-allocation, and accounting facts. Coupling these concerns causes seller money to be created from order intent, makes COD indistinguishable from collected cash, and permits mutable balances to conceal refund or chargeback history.

## Decision

The services own these facts and responsibilities:

```text
payment-service         = provider capture/refund/chargeback facts
shipping-service        = verified delivery and COD collection facts
order-service           = immutable per-sub-order commercial allocation
seller-finance-service  = seller/platform accounting and payouts
```

`order-service` freezes the allocation and commission rate per sub-order:

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

Every amount is a `BigDecimal` paired with its currency. `order.created` records commercial intent and never creates seller money. Prepaid settlement requires verified provider capture and the applicable fulfillment-release fact. COD settlement requires verified COD collection from `shipping-service`; delivery or confirmation alone is insufficient.

`seller-finance-service` posts append-only journals and postings from valid, verified source facts. Refunds, chargebacks, reserves, corrections, and reversals use compensating postings; no process edits or deletes a posted journal. Payouts use stable idempotency keys, and invalid or unknown schemas do not mutate ledger or idempotency state.

## Consequences

- Later finance work must preserve service ownership and consume source facts rather than infer them from another service's mutable state.
- Bank destinations remain within controlled finance integrations and are masked in all externally visible data, logs, and release evidence.
- Production configuration fails closed when required provider, payout, encryption, or destination-masking configuration is missing or invalid.
- Existing wallet and reporting behavior that conflicts with this ADR is migration input, not an exception to the policy.

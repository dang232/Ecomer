# Task 5 Report: Versioned Seller Finance Adjustments

## Scope

- Published version-one seller-finance adjustment envelopes through the order-service transactional outbox.
- Emitted one flag-gated `CREDIT` adjustment per immutable allocation after a completed payment.
- Emitted a flag-gated buyer-confirmed `RELEASE` snapshot after delivery confirmation.
- Added a fail-closed seller-finance contract listener with retry/DLT rejection behavior.
- Disabled the legacy order-created wallet consumer by default without deleting it.
- Aligned the shared JSON schema with the numeric sub-order ID and all 12 persisted financial components.

## TDD Evidence

- Order producer tests were written before the new event publisher and failed until the production symbols were added.
- Seller-finance contract tests were written before the listener and failed until schema validation and retry/DLT annotations were implemented.
- Regression tests then caught and fixed unpaid release, missing payment status, unstable causation IDs, non-mandatory allocation lookup, and permissive consumer validation.

## Verification

```text
order-service focused tests: 25 passed
seller-finance-service focused contract tests: 11 passed
order-service full suite: passed
seller-finance-service full suite: passed
git diff --check: passed
seller-finance-adjustment-v1.schema.json: parsed successfully
```

Seven-day auto-confirm and hold-aware release scheduling remain assigned to Task 7, where the release scheduler and reversal lifecycle are introduced.

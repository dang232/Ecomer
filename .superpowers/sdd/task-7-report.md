# Task 7 Progress Report

## Completed In This Slice

- Added partial-refund persistence keyed by stable `reversalId`, cumulative refund validation, provider idempotency, and `PARTIALLY_REFUNDED` payment state.
- Linked completed returns to immutable sub-order financial allocations and published proportional `REFUND_REVERSAL` adjustments.
- Added enriched chargeback evidence, admin resolution, order dispute state transitions, and seller-finance `CHARGEBACK_HOLD`, `CHARGEBACK_RELEASE`, and `CHARGEBACK_FINALIZE` events.
- Added payment-service financial-event outbox persistence and retry relay for transactional chargeback resolution publication.
- Preserved seller debt behavior: new credits clear debt before adding the remainder to settlement-pending, and refund recovery consumes settlement-pending, available, reserve, payout-pending, then debt.

## Verification

- `services/payment-service`: `RefundPaymentUseCaseTest,PaymentMigrationIntegrationTest` passed with Docker; Flyway reached v18.
- `services/order-service`: `CompleteReturnUseCaseTest,PaymentRefundedListenerTest,OrderServiceIntegrationTest,SellerFinanceAdjustmentPublisherAdapterTest` passed with Docker.
- `services/seller-finance-service`: `WalletProjectionReconciliationTest,LedgerJournalTest,ApplyFinancialAdjustmentUseCaseTest,SellerFinanceAdjustmentListenerContractTest,LedgerPersistenceIntegrationTest` passed with Docker.
- `git diff --check` passed.

## Remaining Task 7 Work

- Enforce aggregate refund plus chargeback remaining-allocation caps across multiple return/dispute events.
- Add seven-day settlement release claims with `FOR UPDATE SKIP LOCKED`, bounded batches, stable release keys, and return/dispute/fraud/chargeback blocking.
- Add the dedicated scheduler and release eligibility persistence/tests.

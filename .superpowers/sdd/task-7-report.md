# Task 7 Progress Report

## Completed In This Slice

- Added partial-refund persistence keyed by stable `reversalId`, cumulative refund validation, provider idempotency, and `PARTIALLY_REFUNDED` payment state.
- Linked completed returns to immutable sub-order financial allocations and published proportional `REFUND_REVERSAL` adjustments.
- Added `financial_reversals` allocation reservations with row locking, operation idempotency, and a Docker-backed test proving refund plus chargeback cannot exceed one allocation.
- Added enriched chargeback evidence, admin resolution, order dispute state transitions, and seller-finance `CHARGEBACK_HOLD`, `CHARGEBACK_RELEASE`, and `CHARGEBACK_FINALIZE` events.
- Added payment-service financial-event outbox persistence and retry relay for transactional chargeback resolution publication.
- Added seller-finance settlement release candidates, delivery facts, return/dispute/fraud/chargeback hold updates, seven-day eligibility, bounded locking with `SKIP LOCKED`, stable release operation keys, and the scheduled release use case.
- Preserved seller debt behavior: new credits clear debt before adding the remainder to settlement-pending, and refund recovery consumes settlement-pending, available, reserve, payout-pending, then debt.

## Verification

- `services/payment-service`: `RefundPaymentUseCaseTest,PaymentMigrationIntegrationTest,PaymentCallbackOutboxRelayTest,PayPalRefundListenerTest` passed with Docker; Flyway reached v18.
- `services/order-service`: `CompleteReturnUseCaseTest,PaymentRefundedListenerTest,ChargebackAllocationSupportTest,OrderServiceIntegrationTest` passed with Docker; Flyway applied V32 and the allocation-cap integration test passed.
- `services/seller-finance-service`: `SettlementReleaseUseCaseTest,WalletProjectionReconciliationTest,ApplyFinancialAdjustmentUseCaseTest,SellerFinanceAdjustmentListenerContractTest,LedgerPersistenceIntegrationTest,PaymentRefundedFinanceListenerTest` passed with Docker; Flyway applied V9.
- `git diff --check` passed.

## Remaining Task 7 Risks

- PayPal's dedicated refund listener remains a legacy provider path and does not yet use the local partial-refund repository; generic Stripe/refund-request flows use the new reversal ledger.
- A provider timeout after a return reservation needs reconciliation to distinguish an outstanding refund request from a completed refund; the reservation remains active so a chargeback cannot overrun the allocation.

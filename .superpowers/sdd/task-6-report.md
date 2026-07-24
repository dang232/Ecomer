# Task 6 Report: Immutable Seller Ledger

## Scope

- Added balanced, immutable ledger journals and postings with source-operation uniqueness.
- Added seller wallet settlement-pending, available, reserve, payout-pending, debt, fee, refund, and paid-out projections with optimistic versioning.
- Added finance event inbox idempotency and a transactional adjustment application use case.
- Wired the validated seller-finance adjustment consumer to journal and projection mutation while keeping the consumer disabled by default.

## Verification

- `LedgerJournalTest`, `WalletProjectionReconciliationTest`, `ApplyFinancialAdjustmentUseCaseTest`: passed.
- `FinanceMigrationIntegrationTest`: passed through Flyway version 8 in Docker PostgreSQL.
- `LedgerPersistenceIntegrationTest`: passed with Docker PostgreSQL and Kafka; covered balanced persistence, replay, immutable rows, journal-failure rollback, and projection-failure rollback.
- Seller-finance full suite: passed.
- `mvnw.cmd verify`: passed, including the 80% JaCoCo instruction gate.
- `git diff --check`: passed.

## Deferred

Refund/chargeback adjustment types, holds, opening balances, payout journals, and reconciliation workflows remain assigned to later plan tasks.

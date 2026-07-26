# Marketplace Settlement and Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace VNShop's mutable seller wallet with an auditable marketplace settlement system that handles captured payments, COD collection, delivery release, refunds, chargebacks, seller debt, payouts, reporting, and buyer-visible financial timelines.

**Architecture:** `payment-service` owns provider cash facts, `order-service` owns immutable marketplace allocation facts, `shipping-service` owns verified carrier delivery and COD collection facts, and `seller-finance-service` owns seller liabilities, commission revenue, settlement journals, wallet projections, reserves, debt, and payouts. Services communicate through versioned Kafka contracts and service-owned databases; no cross-schema foreign keys or shared Java contract library are introduced.

**Tech Stack:** Java 25, Spring Boot 4.1.0, Spring Kafka, Spring Data JPA, PostgreSQL/Flyway, Testcontainers, Micrometer/Prometheus, React 18, TypeScript, Zod, TanStack Query, Vitest, and Playwright.

## Global Constraints

- Execute implementation from an isolated `feat/marketplace-settlement-ledger` worktree because the current `main` worktree contains unrelated user changes.
- Do not edit merged Flyway migrations. Seller-finance starts at `V8`, payment at `V17`, order at `V31`, shipping at `V3`, and user-service at `V10`.
- Keep schema changes additive and compatible with the previously deployed application.
- Keep rollback SQL outside Flyway's scanned `db/migration` path. Normal rollback switches application modes and leaves immutable journal history intact.
- All amounts use `BigDecimal` and explicit `currency`; the frontend never computes an authoritative payable, earnings, revenue, debt, reserve, or liability value.
- `order.created` must never create seller money.
- COD must not become `COMPLETED` merely because the buyer selected COD.
- Seller-finance applies exact allocation components supplied by order-service and never recalculates historical commission.
- Posted journals and postings are append-only; corrections use linked reversal journals.
- Event processing requires a stable business idempotency key. Missing IDs or unknown major schema versions produce no financial mutation and enter retry/DLT handling.
- Raw bank-account values must not appear in public API responses, seller-finance plaintext columns, logs, metrics, browser state, screenshots, or E2E evidence.
- Existing legacy APIs remain only for an explicitly documented compatibility window. New web flows use the versioned contracts by default.
- No production credential, localhost endpoint, provider mode, or payout execution mode may fail open through a default value.

## Product Policy Locked For This Plan

These defaults come from `docs/ba/02-TRUST.md` and `docs/ba/05-FULFILL.md` and must be recorded in the implementation ADR:

| Policy | Initial rule |
|---|---|
| Sale accrual | Online payments accrue seller pending funds only after provider capture. COD accrues only after verified collection. |
| Settlement release | Release when the buyer confirms receipt, or automatically seven days after verified delivery when no return, dispute, fraud hold, or chargeback hold is open. |
| Payout SLA | Complete an approved payout within three days after settlement eligibility. |
| Coupon funding | Existing coupons are platform-funded until a coupon explicitly records seller funding. |
| Commission base | Item GMV minus seller-funded discount; exclude platform-funded discounts, buyer shipping charge, and tax. |
| Shipping and tax | Buyer-facing shipping and tax are not seller payable in the initial policy. |
| Refund shipping | Non-refundable by default; include only when the approved return explicitly sets `refundShipping=true`. |
| Refund recovery | Consume unsettled, available, reserve, then seller debt. Never clamp or discard value. |
| Chargeback | Open creates a hold, won releases it, lost/accepted finalizes reversal/debt. |
| Reserve | Default rate is zero. The ledger supports reserves, but non-zero risk rules require a separately approved policy value. |
| Payout execution | Production starts fail-closed. `MANUAL_RECORDED` requires maker-checker and external evidence; `PROVIDER` remains disabled until a provider adapter passes sandbox and recovery tests. |

## Safe Payout Milestone Decisions (binding for Task 8 onward)

These decisions come from `.omx/plans/safe-payout-milestone.md` and override any
prior wording in this plan. They must be enforced from Task 8 forward.

1. **Destination ownership.** `user-service` owns enrollment and returns only
   destination ID, bank name/code, last four, and verification state from
   seller self/admin/public responses. `seller-finance-service` fetches the
   verified destination through an authenticated internal contract and stores
   an **encrypted, immutable** `PayoutDestinationSnapshot` plus non-secret
   fingerprint/last-four metadata on the payout.
2. **Posting/projection invariant.** Journal postings must describe the exact
   bucket deltas applied to the wallet. Refund / final chargeback recovery
   order is `settlementPending -> available -> reserve -> debt`; `payoutPending`
   is excluded so an already-reserved payout cannot be silently consumed.
   Chargeback holds move funds from the exact funded buckets into `reserve`
   and record the source allocation; release restores from the immutable hold
   allocation; finalize consumes held reserve first and only then applies any
   uncovered amount through the recovery order.
3. **Flyway numbering (Task 8 / 12 renumbering).** user-service Task 8
   migration is `V10__secure_payout_destination.sql`; seller-finance Task 8
   is `V10__payout_execution_expand.sql`; seller-finance Task 12 is
   `V11__settlement_reconciliation_expand.sql`. No second V9 or V10 may be
   added in `seller-finance-service`.
4. **Event mode boundary.** `SELLER_FINANCE_EVENT_MODE=OFF|SHADOW|PRIMARY`
   is the single binding for credit, release, refund, and chargeback
   adjustments across `order-service` publishers and `seller-finance-service`
   consumers. `OFF`: legacy listeners remain authoritative, no new mutation.
   `SHADOW`: versioned path produces comparison evidence only; payout
   execution remains disabled. `PRIMARY`: versioned path is authoritative;
   legacy order-created/direct-refund mutations are disabled. Conflicting
   producer/consumer mode combinations fail startup. Fragmented producer/
   consumer booleans remain only as deprecated aliases during the Task 14
   compatibility window.
5. **Canonical payout vocabulary.** Only `REQUESTED`, `APPROVED`, `SUBMITTING`,
   `SUBMITTED`, `PAID`, `UNKNOWN`, `FAILED`, `REJECTED`, `CANCELLED`, and
   `REVERSED` may be emitted or rendered. `PENDING` / `COMPLETED` are
   translation-only within the compatibility window and never new-code.
6. **Compatibility window.** Gateway route paths and list endpoints remain in
   service for Task 14, but payloads/statuses map to the canonical model. The
   unsafe no-evidence admin completion path is not preserved — it is replaced
   by the maker-checker + manual evidence flow.

## Later Release Gates (carried to Tasks 12–15)

The milestone stop condition is code-complete / release-gated, not
production-ready. Tasks 12–15 must independently close: reconciliation and
alerts (V11), opening-balance backfill and compare/primary cutover,
gateway authorization, browser journeys, provider sandbox and manual
evidence, and a seven-day / one-cycle stability window.

## Canonical Terminology

| Term | Definition | Owner |
|---|---|---|
| Paid GMV | Paid seller item value before refunds and commission | order-service |
| Refunded GMV | Buyer-facing amount successfully refunded | order-service |
| Net paid GMV | `paidGmv - refundedGmv` | order-service |
| Gross commission revenue | Commission charged from immutable allocations | seller-finance-service |
| Net commission revenue | `commissionCharged - commissionReversed` | seller-finance-service |
| Seller pending liability | Captured/collected seller payable not yet released | seller-finance-service |
| Seller available liability | Released seller payable available for payout | seller-finance-service |
| Pending payout liability | Reserved seller funds awaiting payout completion | seller-finance-service |
| Seller debt receivable | Reversals not recoverable from seller balances | seller-finance-service |
| Platform profit | Not available; provider fees, subsidies, taxes, chargebacks, and operating costs are incomplete | none |

## Delivery Sequence

| Stage | Review gate | Producer enablement |
|---|---|---|
| A | Policy, migration rules, schemas, test harness | None |
| B | COD truth and immutable order allocation | No seller-finance producer enabled |
| C | Seller ledger, projection, and disabled consumer | Consumer deployed disabled |
| D | Versioned adjustments, settlement release, refunds, chargebacks | Consumer before producer |
| E | Payout security and state machine | Payout execution remains disabled |
| F | APIs, reporting, checkout quotes, and frontend | Versioned endpoints become web defaults |
| G | Backfill, dual read, reconciliation, and operations | Ledger becomes primary after gates |
| H | Legacy retirement | After retention window and two stable releases |

---

### Task 1: Record Finance Policy And Correct Migration Rollback Rules

**Files:**
- Create: `docs/MARKETPLACE-SETTLEMENT-LEDGER.md`
- Create: `docs/adr/ADR-002-marketplace-finance-ownership.md`
- Modify: `infra/migration-policy.md`
- Modify: `docs/ba/05-FULFILL.md`
- Modify: `infra/production-no-go-checklist.md`

**Interfaces:**
- Produces: the ownership, terminology, settlement, COD, refund, chargeback, reserve, and payout rules consumed by every later task.
- Produces: a forward-only Flyway policy with non-scanned incident rollback scripts.

- [x] **Step 1: Write the ADR with explicit ownership and equations**

The ADR must include:

```text
payment-service         = provider capture/refund/chargeback facts
shipping-service        = verified delivery and COD collection facts
order-service           = immutable per-sub-order commercial allocation
seller-finance-service  = seller/platform accounting and payouts

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

- [x] **Step 2: Correct the rollback policy**

Replace the rule that places a forward migration and its reverse migration in the same Flyway scan path. State that additive migrations remain in `db/migration`, prepared incident scripts live in `db/rollback`, and ordinary rollback switches application feature modes while leaving additive tables and journal history intact.

- [x] **Step 3: Add named release gates**

The no-go checklist must block production when COD collection truth, ledger balance, backfill evidence, payout idempotency, provider/manual evidence, projection drift, DLT health, or destination masking is unproven.

- [x] **Step 4: Verify documentation is internally consistent**

Run:

```powershell
rg -n "reverse V|realizedRevenue|order.created.*credit|clamp.*zero|seller-finance.*deprecated" README.md Architech.md docs infra services/seller-finance-service
```

Expected: every remaining match is either corrected in this task or listed in Task 14's stale-document cleanup.

- [x] **Step 5: Commit**

```powershell
git add docs/MARKETPLACE-SETTLEMENT-LEDGER.md docs/adr/ADR-002-marketplace-finance-ownership.md docs/ba/05-FULFILL.md infra/migration-policy.md infra/production-no-go-checklist.md
git commit -m "docs(finance): define marketplace settlement policy"
```

---

### Task 2: Add Contract Schemas And Integration Test Harnesses

**Files:**
- Create: `infra/kafka/contracts/seller-finance-adjustment-v1.schema.json`
- Create: `infra/kafka/contracts/payment-refund-requested-v2.schema.json`
- Create: `infra/kafka/contracts/payment-refunded-v2.schema.json`
- Create: `infra/kafka/contracts/payment-chargeback-created-v2.schema.json`
- Create: `infra/kafka/contracts/payment-chargeback-resolved-v1.schema.json`
- Create: `infra/kafka/contracts/shipping-cod-collected-v1.schema.json`
- Modify: `services/seller-finance-service/pom.xml`
- Modify: `services/payment-service/pom.xml`
- Modify: `.github/workflows/ci.yml`
- Create: `services/seller-finance-service/src/test/java/com/vnshop/sellerfinanceservice/integration/TestcontainersConfig.java`
- Create: `services/payment-service/src/test/java/com/vnshop/paymentservice/integration/TestcontainersConfig.java`

**Interfaces:**
- Produces: JSON contract fixtures for independently deployed producers/consumers.
- Produces: PostgreSQL and Kafka integration-test infrastructure matching order-service's existing Testcontainers pattern.

- [x] **Step 1: Define the finance adjustment contract**

The schema requires:

```json
{
  "eventId": "uuid",
  "eventType": "SELLER_FINANCE_ADJUSTMENT",
  "schemaVersion": 1,
  "occurredAt": "instant",
  "producer": "order-service",
  "aggregateId": "sellerId",
  "correlationId": "orderId",
  "causationId": "upstreamEventId",
  "payload": {
    "adjustmentId": "uuid",
    "adjustmentType": "CREDIT|RELEASE|REFUND_REVERSAL|CHARGEBACK_HOLD|CHARGEBACK_RELEASE|CHARGEBACK_FINALIZE",
    "allocationId": "uuid",
    "allocationVersion": 1,
    "orderId": "uuid",
    "subOrderId": "uuid",
    "sellerId": "string",
    "reversalId": "uuid|null",
    "currency": "VND",
    "components": {}
  }
}
```

All amounts are positive; `adjustmentType` determines accounting direction.

- [x] **Step 2: Add Testcontainers dependencies**

Add test-scoped `org.testcontainers:junit-jupiter`, `org.testcontainers:postgresql`, `org.testcontainers:kafka`, and `org.springframework.boot:spring-boot-testcontainers` to seller-finance and payment services.

- [x] **Step 3: Add clean-schema boot tests**

Create `FinanceMigrationIntegrationTest` and `PaymentMigrationIntegrationTest`. Each test starts PostgreSQL, runs the service's Flyway history, and asserts the current schema version.

- [x] **Step 4: Extend CI**

Add integration steps for seller-finance and payment beside the existing order migration test. Run `mvn verify`, not only isolated unit tests, for those services when their files or shared finance contracts change.

- [x] **Step 5: Verify**

```powershell
Set-Location services/seller-finance-service
.\mvnw.cmd --batch-mode --no-transfer-progress "-Dtest=FinanceMigrationIntegrationTest" test
Set-Location ../payment-service
.\mvnw.cmd --batch-mode --no-transfer-progress "-Dtest=PaymentMigrationIntegrationTest" test
```

Expected: both tests pass against fresh PostgreSQL containers.

- [x] **Step 6: Commit**

```powershell
git add infra/kafka/contracts services/seller-finance-service/pom.xml services/payment-service/pom.xml services/seller-finance-service/src/test services/payment-service/src/test .github/workflows/ci.yml
git commit -m "test(finance): add contracts and integration harness"
```

---

### Task 3: Correct COD Payment And Collection Semantics

**Files:**
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/domain/PaymentStatus.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/gateway/CodPaymentMethodHandler.java`
- Create: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/event/CodCollectedListener.java`
- Create: `services/payment-service/src/main/java/com/vnshop/paymentservice/application/ConfirmCodCollectionUseCase.java`
- Create: `services/payment-service/src/main/resources/db/migration/V17__cod_collection_and_refund_records.sql`
- Modify: `services/shipping-service/src/main/java/com/vnshop/shippingservice/domain/model/CarrierWebhookEvent.java`
- Modify: `services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/event/ShippingEventPublisher.java`
- Create: `services/shipping-service/src/main/java/com/vnshop/shippingservice/domain/model/CodCollectionEvidence.java`
- Create: `services/shipping-service/src/main/resources/db/migration/V3__cod_collection_evidence.sql`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/domain/PaymentStatus.java`

**Interfaces:**
- Consumes: verified carrier webhook identity and the expected COD amount stored when the label is created.
- Produces: `shipping.cod.collected` v1 only when collection evidence is verifiable.
- Produces: ordinary durable `payment.completed` after COD collection, so downstream consumers do not need a COD special case.

- [x] **Step 1: Write failing COD tests**

Add tests proving:

```java
assertThat(codHandler.processPayment(payment).status())
        .isEqualTo(PaymentStatus.AWAITING_COLLECTION);

verify(paymentCompletedPublisher, never()).publish(any());
```

Add duplicate carrier-event and mismatched-amount tests.

- [x] **Step 2: Add `AWAITING_COLLECTION`**

`CodPaymentMethodHandler` returns `AWAITING_COLLECTION`, never `COMPLETED`. The payment record keeps its expected VND amount and a generated COD reference.

- [x] **Step 3: Publish verified collection**

Shipping persists carrier event ID, order ID, tracking code, expected COD amount, collected amount, provider timestamp, and evidence status. A carrier status without actual collection evidence must not publish `shipping.cod.collected`; it remains operationally unresolved.

- [x] **Step 4: Promote COD idempotently**

`ConfirmCodCollectionUseCase` locks the payment, checks method/status/order/currency/amount, persists the collection event ID, then promotes through the existing payment callback outbox so `payment.completed` remains durable.

- [x] **Step 5: Verify**

```powershell
Set-Location services/payment-service
.\mvnw.cmd "-Dtest=CodPaymentMethodHandlerTest,ConfirmCodCollectionUseCaseTest,CodCollectedListenerTest" test
Set-Location ../shipping-service
.\mvnw.cmd "-Dtest=*Webhook*Test,*CodCollection*Test" test
```

Expected: selecting COD creates no completed event; one verified collection creates exactly one completed event.

- [x] **Step 6: Commit**

```powershell
git add services/payment-service services/shipping-service services/order-service/src/main/java/com/vnshop/orderservice/domain/PaymentStatus.java
git commit -m "fix(payment): require verified COD collection"
```

---

### Task 4: Persist Immutable Per-Sub-Order Financial Allocations

**Files:**
- Create: `services/order-service/src/main/resources/db/migration/V31__sub_order_financial_allocations.sql`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/domain/finance/FinancialComponents.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/domain/finance/SubOrderFinancialAllocation.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/domain/port/out/SubOrderFinancialAllocationRepositoryPort.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/application/finance/AllocateOrderFinancialsUseCase.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/persistence/SubOrderFinancialAllocationJpaEntity.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/persistence/SubOrderFinancialAllocationJpaRepository.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/application/CreateOrderUseCase.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/persistence/OrderJpaEntity.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/persistence/OrderItemJpaEntity.java`

**Interfaces:**
- Produces: immutable `SubOrderFinancialAllocation` records consumed by credits, releases, refunds, chargebacks, reporting, and checkout quotes.

```java
public record FinancialComponents(
        BigDecimal itemGmvAmount,
        BigDecimal sellerFundedDiscountAmount,
        BigDecimal platformFundedDiscountAmount,
        BigDecimal buyerShippingChargeAmount,
        BigDecimal sellerShippingPayableAmount,
        BigDecimal taxChargedAmount,
        BigDecimal sellerTaxPayableAmount,
        BigDecimal commissionBaseAmount,
        BigDecimal platformCommissionAmount,
        BigDecimal sellerPayableAmount,
        BigDecimal buyerPaidAmount,
        String currency) {}
```

- [x] **Step 1: Write allocation tests**

Cover one seller, multiple sellers, proportional discount allocation, deterministic remainder assignment by ascending `subOrderId`, frozen commission rates, tax persistence, and exact aggregate equality.

- [x] **Step 2: Add the allocation table**

Use UUID allocation IDs, unique `(sub_order_id, allocation_version)`, explicit component columns, commission tier/rate, source `NATIVE_V1|LEGACY_BACKFILL`, and timestamps. Do not add cross-schema keys.

- [x] **Step 3: Implement deterministic allocation**

Require:

```text
sum(buyerPaidAmount) == order.finalAmount
sum(platformFundedDiscountAmount) == order.discount
sum(buyerShippingChargeAmount) == order.shippingTotal
sum(taxChargedAmount) == order.taxTotal
```

Persist the allocation in the same transaction as order creation.

- [x] **Step 4: Fix tax JPA mapping**

Map the columns introduced by `V24__tax_rates.sql`; tests must round-trip order tax total and item tax data.

- [x] **Step 5: Verify**

```powershell
Set-Location services/order-service
.\mvnw.cmd "-Dtest=SubOrderFinancialAllocationTest,AllocateOrderFinancialsUseCaseTest,OrderJpaEntityFinancialMappingTest,OrderServiceIntegrationTest" test
```

Expected: all allocation sums equal authoritative order totals exactly.

- [x] **Step 6: Commit**

```powershell
git add services/order-service
git commit -m "feat(order): snapshot seller financial allocations"
```

---

### Task 5: Publish Versioned Seller Finance Adjustments

**Files:**
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/event/finance/SellerFinanceAdjustmentEvent.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/event/finance/SellerFinanceAdjustmentPublisherAdapter.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/domain/port/out/SellerFinanceAdjustmentPublisherPort.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/event/payment/PaymentCompletedListener.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/application/ConfirmDeliveryUseCase.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/outbox/OutboxPublisher.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/event/SellerFinanceAdjustmentListener.java`
- Modify: `services/seller-finance-service/src/main/resources/application.yml`

**Interfaces:**
- Consumes: allocation ID/version and exact component snapshot.
- Produces: `seller.finance.adjustment`, partitioned by seller ID.
- Producer flag: `SELLER_FINANCE_ADJUSTMENTS_ENABLED=false` until Task 6's consumer is deployed.
- Consumer flag: `SELLER_FINANCE_ADJUSTMENT_CONSUMER_ENABLED=false` until migration verification passes.

- [x] **Step 1: Add serialization and rejection tests**

Test all required IDs, exact components, schema version, timestamp, seller partition key, missing-ID rejection, and unknown-version DLT behavior.

- [x] **Step 2: Publish credit only after captured/collected payment**

One `payment.completed` creates one `CREDIT` adjustment per allocation. `order.created` creates none.

- [x] **Step 3: Publish release eligibility**

Delivery records `deliveredAt`; a later release use case emits `RELEASE` only after buyer confirmation or seven-day auto-confirm and only when no hold is open.

The buyer-confirmed `RELEASE` publisher is wired in Task 5. Seven-day auto-confirm, hold-aware scheduling, and stable release operation idempotency remain implemented by Task 7's release scheduler.

- [x] **Step 4: Keep legacy consumers disabled by configuration**

Do not delete `OrderCreatedFinanceListener` yet. Add a fail-closed legacy-consumer flag so deployment can switch only after shadow comparison.

- [x] **Step 5: Verify**

```powershell
Set-Location services/order-service
.\mvnw.cmd "-Dtest=SellerFinanceAdjustmentPublisherAdapterTest,PaymentCompletedListenerTest,ConfirmDeliveryUseCaseTest" test
Set-Location ../seller-finance-service
.\mvnw.cmd "-Dtest=SellerFinanceAdjustmentListenerContractTest" test
```

- [x] **Step 6: Commit**

```powershell
git add services/order-service services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/event services/seller-finance-service/src/main/resources/application.yml
git commit -m "feat(finance-events): add versioned seller adjustments"
```

---

### Task 6: Add The Immutable Seller Ledger And Wallet Projection

**Files:**
- Create: `services/seller-finance-service/src/main/resources/db/migration/V8__marketplace_ledger_expand.sql`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/domain/LedgerAccountCode.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/domain/LedgerDirection.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/domain/LedgerJournalType.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/domain/LedgerPosting.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/domain/LedgerJournal.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/domain/port/out/LedgerRepositoryPort.java`
- Create persistence adapters under `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/persistence/`
- Modify: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/domain/SellerWallet.java`
- Modify: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/persistence/SellerWalletJpaEntity.java`
- Modify: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/persistence/SellerWalletSpringDataRepository.java`

**Interfaces:**
- Produces: balanced immutable journals and a rebuildable wallet projection.
- Projection buckets: `settlementPending`, `available`, `reserve`, `payoutPending`, `debt`, `totalFees`, `totalRefunded`, `totalPaidOut`.

- [x] **Step 1: Write domain invariant tests**

Test balanced-by-currency journals, positive posting amounts, unique source operation, linked reversal, no mutation, and exact wallet projection equations.

- [x] **Step 2: Add ledger schema**

Create:

```text
ledger_accounts
ledger_journals
ledger_postings
finance_event_inbox
wallet_projection_checkpoints
```

Add unique `(source_type, source_id, operation_type)`, immutable update/delete triggers, and deferred validation constraints.

- [x] **Step 3: Expand the wallet projection**

Add projection columns and JPA `@Version`. Replace `pending_balance` semantics with separate settlement-pending and payout-pending values. Do not reinterpret old data yet; Task 13 owns opening balances.

- [x] **Step 4: Apply adjustments atomically**

Create `ApplyFinancialAdjustmentUseCase`. In one database transaction it records inbox identity, writes a balanced journal, updates the locked projection, and returns the existing result on idempotent replay.

- [x] **Step 5: Verify failure atomicity**

Integration tests inject a failure after journal creation and after projection mutation. Both paths must roll back completely.

- [x] **Step 6: Verify**

```powershell
Set-Location services/seller-finance-service
.\mvnw.cmd "-Dtest=LedgerJournalTest,ApplyFinancialAdjustmentUseCaseTest,LedgerPersistenceIntegrationTest,WalletProjectionReconciliationTest" test
.\mvnw.cmd verify
```

- [x] **Step 7: Commit**

```powershell
git add services/seller-finance-service
git commit -m "feat(finance): add immutable settlement ledger"
```

---

### Task 7: Implement Release, Refund, And Chargeback Accounting

**Files:**
- Create: `services/order-service/src/main/resources/db/migration/V32__financial_reversals.sql`
- Create order reversal domain/persistence/use-case files under `domain/finance`, `application/finance`, and `infrastructure/persistence`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/application/CompleteReturnUseCase.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/domain/RefundLedgerEntry.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/application/RefundPaymentCommand.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/application/RefundPaymentUseCase.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/domain/PaymentStatus.java`
- Create: `services/payment-service/src/main/resources/db/migration/V18__financial_event_outbox.sql`
- Modify chargeback domain, persistence, service, and webhook controllers in payment-service
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/application/ReleaseEligibleSettlementsUseCase.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/scheduling/SettlementReleaseScheduler.java`

**Interfaces:**
- Refunds reference the original allocation and stable `reversalId`.
- Chargebacks publish opened and resolved events with challenged amount/currency and provider IDs.
- Seller-finance applies exact reversals and never calls `CommissionCalculator` for historical transactions.

- [x] **Step 1: Add partial-refund persistence and tests**

Payment status adds `PARTIALLY_REFUNDED`. A payment becomes `REFUNDED` only when cumulative completed refunds equal captured amount. Provider idempotency uses `reversalId`, not payment ID.

- [x] **Step 2: Create allocation-linked reversals**

`CompleteReturnUseCase` calculates buyer refund, seller-payable reversal, and commission reversal from the immutable allocation. Refund plus chargeback may never exceed the remaining allocation.

- [x] **Step 3: Add chargeback lifecycle**

```text
OPEN      -> CHARGEBACK_HOLD
WON       -> CHARGEBACK_RELEASE
LOST      -> CHARGEBACK_FINALIZE
ACCEPTED  -> CHARGEBACK_FINALIZE
```

Resolution publishes transactionally through payment-service's outbox.

- [x] **Step 4: Add seven-day settlement release**

The scheduler uses `FOR UPDATE SKIP LOCKED`, a bounded batch, and a stable release operation key. Open returns, disputes, fraud holds, or chargebacks block release.

- [x] **Step 5: Preserve seller debt**

Reversal funding order is settlement pending, available, reserve, then debt. Future credits clear debt before becoming available.

- [x] **Step 6: Verify**

```powershell
Set-Location services/payment-service
.\mvnw.cmd "-Dtest=RefundPaymentUseCaseTest,RefundRequestListenerTest,ChargebackServiceTest,PaymentFinancialEventOutboxRelayTest" test
Set-Location ../order-service
.\mvnw.cmd "-Dtest=CompleteReturnUseCaseTest,PaymentRefundedListenerTest,ChargebackCreatedListenerTest,ChargebackResolvedListenerTest" test
Set-Location ../seller-finance-service
.\mvnw.cmd "-Dtest=SettlementReleaseUseCaseTest,RefundReversalUseCaseTest,SellerWalletAdjustmentTest" test
```

The repository does not yet contain the three legacy-named listener tests in the original command. Equivalent focused coverage is provided by `PaymentCallbackOutboxRelayTest`, `PayPalRefundListenerTest`, `ChargebackAllocationSupportTest`, `SettlementReleaseUseCaseTest`, and the Docker-backed order/seller-finance integration tests recorded in `.superpowers/sdd/task-7-report.md`.

- [x] **Step 7: Commit**

```powershell
git add services/payment-service services/order-service services/seller-finance-service
git commit -m "feat(finance): account for release refunds and chargebacks"
```

---

### Task 8: Secure Payout Destinations And Add The Payout State Machine

**Files:**
- Create: `services/user-service/src/main/resources/db/migration/V10__secure_payout_destination.sql`
- Modify user-service seller profile persistence and responses
- Create: `services/user-service/src/main/java/com/vnshop/userservice/infrastructure/web/SellerPayoutDestinationResponse.java`
- Create: `services/seller-finance-service/src/main/resources/db/migration/V10__payout_execution_expand.sql`
- Modify seller-finance `Payout`, `PayoutStatus`, repositories, use cases, controllers, and responses
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/domain/PayoutDestinationSnapshot.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/domain/port/out/PayoutProviderPort.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/domain/port/out/PayoutDestinationCipherPort.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/security/PayoutDestinationCryptoAdapter.java`

**Interfaces:**
- Seller public/self profile returns bank name, last four digits, and verification state, never raw account.
- Payout request accepts `{amount}` plus `Idempotency-Key`.
- Payout execution modes: `DISABLED|MANUAL_RECORDED|PROVIDER`.

```text
REQUESTED -> APPROVED -> SUBMITTING -> SUBMITTED -> PAID
         \-> REJECTED
SUBMITTING/SUBMITTED -> UNKNOWN -> PAID|FAILED
FAILED/REJECTED/CANCELLED -> reservation reversal
PAID -> REVERSED
```

- [ ] **Step 1: Write redaction tests**

Assert raw account values do not appear in seller responses, payout responses, logs, serialization snapshots, or frontend fixtures.

- [ ] **Step 2: Secure the destination**

Migrate existing account values into encrypted destination data with deterministic fingerprint and last-four projection. Production requires an explicit encryption key.

- [ ] **Step 3: Add atomic payout reservation**

Lock wallet, validate available/debt/hold/KYC/destination, insert payout and reservation journal in one transaction, and return the existing payout on an idempotency-key retry.

- [ ] **Step 4: Add maker-checker controls**

Requester, approver, and payer identities are separate. `approvedBy` and `paidBy` must differ. Manual completion requires external reference and evidence hash.

- [ ] **Step 5: Handle provider uncertainty**

A timeout after submission becomes `UNKNOWN`; recovery queries provider state before retry. Provider idempotency derives from internal payout ID.

- [ ] **Step 6: Verify**

```powershell
Set-Location services/user-service
.\mvnw.cmd "-Dtest=*Seller*Payout*Test,*SellerProfile*Test" test
Set-Location ../seller-finance-service
.\mvnw.cmd "-Dtest=PayoutStateMachineTest,PayoutUseCasesTest,ConcurrentPayoutIntegrationTest,AdminFinanceControllerTest" test
```

- [ ] **Step 7: Commit**

```powershell
git add services/user-service services/seller-finance-service
git commit -m "feat(payouts): secure and control seller payouts"
```

---

### Task 9: Add Finance Reporting, Ledger Search, And Paged Payout APIs

**Files:**
- Modify: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/web/SellerFinanceController.java`
- Modify: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/web/AdminFinanceController.java`
- Modify: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/web/WalletResponse.java`
- Create seller/admin report, entry, page, payout-detail, and reconciliation response types
- Create report/search use cases and repository queries
- Modify order-service dashboard domain/responses to add `netPaidGmv` and deprecate `realizedRevenue`

**Interfaces:**
- Seller:
  - `GET /sellers/me/finance/wallet`
  - `GET /sellers/me/finance/report`
  - `GET /sellers/me/finance/entries`
  - `GET /sellers/me/finance/payouts`
- Admin:
  - `GET /admin/finance/report`
  - `GET /admin/finance/entries`
  - `GET /admin/finance/payouts`
  - `GET /admin/finance/payouts/{payoutId}`
  - `GET /admin/finance/export`

- [ ] **Step 1: Write API contract tests**

All money responses require `currency`, `asOf`, period, `coverageStartsAt`, and `isPartial`. Lists use bounded page contracts and stable sorting.

- [ ] **Step 2: Add seller report**

Return gross paid GMV, refunded GMV, net paid GMV, commissions, commission reversals, net earnings, paid out, and balance buckets.

- [ ] **Step 3: Add admin platform finance report**

Return net commission revenue, seller liabilities, debt receivable, payout counts/amounts by state, and coverage. Never label this profit.

- [ ] **Step 4: Add server-side search**

Filters include seller ID/name, order ID/number, allocation, refund, chargeback, payout, event type, status, date, currency, amount range, and reconciliation state.

- [ ] **Step 5: Add compatibility aliases**

Keep existing pending/completed payout endpoints and `realizedRevenue` as deprecated wrappers for one release. New frontend code uses the new contracts immediately.

- [ ] **Step 6: Verify**

```powershell
Set-Location services/seller-finance-service
.\mvnw.cmd "-Dtest=SellerFinanceControllerTest,AdminFinanceControllerTest,GetSellerFinanceReportUseCaseTest,GetAdminFinanceReportUseCaseTest,SearchFinanceEntriesUseCaseTest" test
Set-Location ../order-service
.\mvnw.cmd "-Dtest=GetDashboardUseCaseTest,AdminDashboardControllerTest" test
```

- [ ] **Step 7: Commit**

```powershell
git add services/seller-finance-service services/order-service
git commit -m "feat(finance-api): expose reports search and liabilities"
```

---

### Task 10: Add Server Checkout Quotes And Buyer Financial Timeline

**Files:**
- Create: `services/order-service/src/main/resources/db/migration/V33__checkout_quotes.sql`
- Create: `services/order-service/src/main/resources/db/migration/V34__order_financial_timeline.sql`
- Create checkout quote domain, ports, use cases, persistence, and web DTOs
- Create buyer financial event domain, ports, use case, persistence, and response DTOs
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/CheckoutController.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/application/CalculateCheckoutUseCase.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/application/CheckoutOrderUseCase.java`
- Modify payment/refund/return listeners and use cases to append timeline events
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/ReturnController.java`

**Interfaces:**
- `POST /checkout/quotes`
- `GET /checkout/quotes/{quoteId}`
- `POST /checkout/quotes/{quoteId}/orders`
- `GET /orders/{orderId}/financial-timeline`
- `GET /returns/{returnId}`

- [ ] **Step 1: Write quote tests**

A quote is buyer-bound, hash-bound, versioned, expiring, single-consumption, server-priced, and idempotent. Remove cart-price and frontend-total fallbacks.

- [ ] **Step 2: Persist canonical quote components**

Store item, seller, shipping, discount, tax, currency, pricing version, input hash, expiry, and consumption state. Order creation consumes the exact quote snapshot while still rechecking inventory.

- [ ] **Step 3: Write timeline tests**

Cover payment pending/completed, COD awaiting collection, return requested/approved/rejected/completed, refund processing/refunded/partial, dispute side branch, and chargeback.

- [ ] **Step 4: Enforce ownership**

Buyer timeline and return detail return 403/404 for another buyer and cannot leak provider or seller-private data.

- [ ] **Step 5: Verify**

```powershell
Set-Location services/order-service
.\mvnw.cmd "-Dtest=CreateCheckoutQuoteUseCaseTest,ConsumeCheckoutQuoteUseCaseTest,CheckoutQuoteControllerTest,GetBuyerFinancialTimelineUseCaseTest,BuyerFinancialTimelineControllerTest" test
```

- [ ] **Step 6: Commit**

```powershell
git add services/order-service
git commit -m "feat(order): add checkout quotes and finance timeline"
```

---

### Task 11: Update Seller, Admin, Buyer, And Checkout Frontends

**Files:**
- Modify: `fe/src/app/types/api/seller-finance.ts`
- Modify: `fe/src/app/types/api/admin.ts`
- Modify: `fe/src/app/types/api/payment.ts`
- Create: `fe/src/app/types/api/order-finance.ts`
- Modify seller-finance, admin, checkout, order, and returns endpoint modules
- Modify: `fe/src/app/pages/seller/SellerDashboard.tsx`
- Modify: `fe/src/app/pages/seller/SellerWallet.tsx`
- Create: `fe/src/app/pages/seller/SellerFinanceLedger.tsx`
- Modify: `fe/src/app/pages/admin/AdminDashboard.tsx`
- Modify: `fe/src/app/pages/admin/PayoutsQueue.tsx`
- Create: `fe/src/app/pages/admin/PayoutDetailDrawer.tsx`
- Modify: `fe/src/app/pages/OrderDetailPage.tsx`
- Modify: `fe/src/app/pages/ReturnStatusPage.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutPage.tsx`
- Modify English and Vietnamese i18n files

**Interfaces:**
- Consumes only versioned server values.
- Produces no money calculation beyond formatting.

- [ ] **Step 1: Make Zod schemas strict**

Remove legacy aliases from new v2 schemas. Accept every documented backend status and reject unknown money shapes with a controlled error state.

- [ ] **Step 2: Update seller finance UI**

Show gross paid GMV, net earnings, available, settlement pending, reserve, payout pending, debt, paid out, coverage, report period, and `asOf`.

- [ ] **Step 3: Separate marketplace and platform finance**

Admin dashboard shows paid/refunded/net GMV separately from commission revenue and seller liabilities. It does not call either number profit.

- [ ] **Step 4: Update payout UI**

Remove raw bank-account entry. Show verified masked destination, server-calculated eligibility, state history, failure reason, maker-checker actions, server search, pagination, and detail.

- [ ] **Step 5: Add buyer timeline**

Render return/refund branches and COD awaiting collection. Dispute is a side branch, not a linear return state.

- [ ] **Step 6: Require a fresh checkout quote**

Cart, address, shipping, or coupon changes invalidate the quote. Disable order placement while missing, stale, expired, or mismatched. Render only quote totals.

- [ ] **Step 7: Verify**

```powershell
Set-Location fe
npm run typecheck
npm run lint:all
npm run format:check
npm test -- SellerWallet.test.tsx PayoutsQueue.test.tsx SellerDashboard.test.tsx CheckoutPage.test.tsx OrderDetailPage.test.tsx ReturnStatusPage.test.tsx
npm run build
```

Expected: all commands pass and no test fixture contains a raw bank account.

- [ ] **Step 8: Commit**

```powershell
git add fe/src
git commit -m "feat(finance-ui): show authoritative marketplace money"
```

---

### Task 12: Add Reconciliation, Metrics, Alerts, And Fail-Closed Configuration

**Files:**
- Create: `services/seller-finance-service/src/main/resources/db/migration/V11__settlement_reconciliation_expand.sql`
- Create reconciliation domain, persistence, use case, and scheduler files
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/metrics/SettlementMetrics.java`
- Modify: `services/seller-finance-service/src/main/resources/application.yml`
- Modify: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/config/SecurityConfig.java`
- Modify: `infra/k8s/generate.py`
- Regenerate: `infra/k8s/base/monitoring.yaml`
- Modify: `infra/prometheus/rules.yml`
- Modify Kafka topic and ACL scripts/manifests

**Interfaces:**
- Produces fingerprinted reconciliation issues and bounded resumable runs.
- Produces low-cardinality Micrometer metrics.

- [ ] **Step 1: Implement reconciliation checks**

Check journal balance, ledger/projection equality, payout reservations, source duplicates/missing facts, release eligibility, provider payout state, backfill evidence, and issue aging.

- [ ] **Step 2: Add metrics**

```text
vnshop_settlement_journals_total{type,result}
vnshop_settlement_event_rejections_total{reason}
vnshop_settlement_projection_drift_accounts
vnshop_settlement_projection_drift_minor_units
vnshop_settlement_reconciliation_open_issues{severity}
vnshop_settlement_payouts{status}
vnshop_settlement_payout_oldest_age_seconds{status}
vnshop_settlement_backfill_last_success_timestamp_seconds
```

Do not label with seller, order, payout, event, journal, or provider IDs.

- [ ] **Step 3: Add alerts**

Critical alerts: journal imbalance, ledger drift after cutover, critical unresolved issue, payout `UNKNOWN` over ten minutes, missing reconciliation/backfill run, and payout failure ratio over 5 percent with a minimum sample.

- [ ] **Step 4: Harden configuration**

Add explicit write/read modes and payout kill switches. Remove DB/Kafka secret defaults and localhost production fallbacks. Keep reconciliation failure out of liveness.

- [ ] **Step 5: Update generated infrastructure**

Change `infra/k8s/generate.py`, regenerate manifests, add finance topics/ACLs, and create a pre-deploy seller-finance migration job plus a protected manual backfill job.

- [ ] **Step 6: Verify**

```powershell
python infra/k8s/generate.py
git diff --exit-code -- infra/k8s/base
python infra/scripts/validate-k8s-release.py --environment staging --allow-unresolved --allow-unsealed
python infra/scripts/validate-k8s-release.py --environment prod --allow-unresolved --allow-unsealed
Set-Location services/seller-finance-service
.\mvnw.cmd "-Dtest=*Reconciliation*Test,*Metrics*Test" test
```

- [ ] **Step 7: Commit**

```powershell
git add services/seller-finance-service infra .github/workflows/ci.yml
git commit -m "ops(finance): add reconciliation alerts and safe modes"
```

---

### Task 13: Backfill Opening Balances And Run Dual-Read Cutover

**Files:**
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/application/migration/SettlementBackfillRunner.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/application/migration/SettlementBackfillReport.java`
- Create backfill checkpoint persistence files
- Create: `infra/settlement-ledger-runbook.md`
- Create non-scanned rollback scripts under `services/seller-finance-service/src/main/resources/db/rollback/`

**Interfaces:**
- Modes:

```text
SETTLEMENT_LEDGER_WRITE_MODE=OFF|SHADOW|PRIMARY
SETTLEMENT_LEDGER_READ_MODE=LEGACY|COMPARE|LEDGER
SETTLEMENT_BACKFILL_ENABLED=false
```

- [ ] **Step 1: Implement dry run**

Report row counts, aggregate wallet buckets, pending payout mismatches, completion-audit gaps, invalid IDs/currency/scale, proposed opening journals, schema versions, offsets, image digest, snapshot time, run ID, and SHA-256 evidence hash.

- [ ] **Step 2: Implement resumable opening balances**

Historical processed-event rows do not contain enough allocation facts. Create explicit `MIGRATION_OPENING_BALANCE` journals; do not fabricate per-order history. Repeating a completed batch inserts zero journals.

- [ ] **Step 3: Reconcile pending payouts**

Every existing pending payout requires a matching migration reservation journal. Any unexplained difference blocks cutover.

- [ ] **Step 4: Run shadow and compare modes**

Deploy in this order:

```text
OFF/LEGACY
SHADOW/LEGACY
SHADOW/COMPARE
PRIMARY/LEDGER
```

Remain in compare mode for seven consecutive days and one complete settlement cycle, whichever is longer.

- [ ] **Step 5: Enforce cutover gate**

Require zero unapproved imbalance, zero drift, no unresolved critical issue, idempotent replay, drained Kafka lag, successful backup/restore drill, and exact staging artifact parity.

- [ ] **Step 6: Verify backfill tests**

```powershell
Set-Location services/seller-finance-service
.\mvnw.cmd "-Dtest=SettlementBackfillDryRunTest,SettlementBackfillResumeTest,OpeningBalanceMigrationTest,WalletProjectionReconciliationTest" test
```

- [ ] **Step 7: Commit**

```powershell
git add services/seller-finance-service infra/settlement-ledger-runbook.md
git commit -m "feat(finance): add resumable ledger backfill"
```

---

### Task 14: Correct Ownership Documentation And Deprecate Legacy Paths

**Files:**
- Modify: `README.md`
- Modify: `Architech.md`
- Modify: `services/AGENTS.md`
- Create or replace: `services/seller-finance-service/AGENTS.md`
- Modify: `services/seller-finance-service/DEPRECATED.md`
- Modify: `docs/ADMIN-DASHBOARD-DATA-FLOW-FINDINGS.md`
- Modify finance sections in historical active guidance documents
- Do not modify: `services/order-service/src/main/resources/db/migration/V8__seller_finance_schema.sql`

**Interfaces:**
- Produces: one authoritative statement that seller-finance-service is active and owns marketplace settlement.
- Produces: explicit deprecation dates and removal gates for legacy consumers/endpoints.

- [ ] **Step 1: Correct service ownership**

Document that the active Spring Boot service on port 8090 owns settlement. Mark `order_svc` finance tables as dormant legacy schema pending a separately approved data audit.

- [ ] **Step 2: Correct workflow diagrams**

Show:

```text
payment capture/COD collection
  -> immutable order allocation
  -> seller pending
  -> delivery and confirmation/7-day auto-release
  -> seller available
  -> payout reservation
  -> manual/provider evidence
  -> paid
```

- [ ] **Step 3: Deprecate old contracts**

List the exact release window for:

```text
order.created wallet credit
direct payment.refunded seller debit
flat payout list wrappers
realizedRevenue alias
legacy web checkout order endpoint
```

Remove them only after Kafka retention expires, versioned consumers are primary, and two stable releases pass.

- [ ] **Step 4: Verify links and contradictions**

```powershell
git diff --check
rg -n "\]\([^)]*\.md(?:#[^)]+)?\)" README.md Architech.md docs services
rg -n "seller-finance.*deprecated|order.created.*wallet|realizedRevenue.*platform revenue|refund.*commissionTier.*match" README.md Architech.md docs services
```

Expected: no active guidance claims the old behavior is production-correct.

- [ ] **Step 5: Commit**

```powershell
git add README.md Architech.md services/AGENTS.md services/seller-finance-service/AGENTS.md services/seller-finance-service/DEPRECATED.md docs
git commit -m "docs(finance): document settlement source of truth"
```

---

### Task 15: Run Cross-Role E2E, Failure Injection, And Final Release Gates

**Files:**
- Modify finance, dashboard, checkout, payment-return, and journey Playwright specs under `fe/e2e/`
- Modify: `infra/scripts/e2e-day.mjs`
- Create/update evidence reports under `fe/e2e/evidence/`
- Modify: `infra/incident-runbook.md`

**Interfaces:**
- Consumes: the fully enabled staging stack.
- Produces: screenshots, traces, reports, reconciliation snapshots, and failure-recovery evidence.

- [ ] **Step 1: Add backend hostile scenarios**

Cover 100 concurrent distinct credits, 100 duplicates of one event, concurrent payout overdraw, duplicate idempotency keys, transaction crash points, refund after payout, chargeback win/loss, provider timeout/unknown recovery, DLT replay, and backfill interruption.

- [ ] **Step 2: Add buyer journey**

Prove authoritative quote total equals persisted order, COD remains awaiting collection, payment/refund timeline renders every state, expired quote blocks order creation, and cross-buyer access is denied.

- [ ] **Step 3: Add seller journey**

Prove paid funds are pending, delivery alone waits for confirmation/hold expiry, release occurs once, wallet buckets reconcile to entries, payout reserves once, debt blocks payout, and no raw bank value is visible.

- [ ] **Step 4: Add admin journey**

Prove GMV and platform finance are separate, payout search/pagination/detail work, maker-checker is enforced, failure reason persists, reconciliation issues are visible, and manual completion requires evidence.

- [ ] **Step 5: Run full verification**

```powershell
Set-Location services/shipping-service
.\mvnw.cmd verify
Set-Location ../payment-service
.\mvnw.cmd verify
Set-Location ../order-service
.\mvnw.cmd verify
Set-Location ../seller-finance-service
.\mvnw.cmd verify
Set-Location ../user-service
.\mvnw.cmd verify
Set-Location ../../fe
npm run verify
npm run test:e2e -- seller-wallet-ui.spec.ts seller-dashboard-ui.spec.ts dashboard-charts-ui.spec.ts checkout-ui.spec.ts payment-return-ui.spec.ts journey/05-seller-cashes-out.spec.ts journey/06-admin-closes-the-loop.spec.ts
Set-Location ..
node infra/scripts/e2e-day.mjs
```

Expected: every command passes; reconciliation reports zero drift; evidence contains no raw bank data or UUID-only primary labels.

- [ ] **Step 6: Complete the release gate**

The change is releasable only when:

```text
ORDER_CREATED creates zero financial postings.
COD collection is verifiable and idempotent.
Every journal balances per currency.
Posted journal rows reject update/delete.
Wallet projection equals journal balances.
Refund and chargeback reversal never exceed allocation.
Debt is represented and blocks payout.
Payout reservation and payout row commit atomically.
Unknown provider state is queried before retry.
Backfill rerun inserts zero duplicates.
Seven-day compare window has zero unapproved drift.
All finance alerts are loaded and exercised.
Backup and restore drill includes finance evidence.
Buyer, seller, and admin authorization tests pass.
```

- [ ] **Step 7: Commit**

```powershell
git add fe/e2e infra/scripts/e2e-day.mjs infra/incident-runbook.md
git commit -m "test(finance): prove marketplace settlement lifecycle"
```

## Explicitly Deferred

- Selecting and integrating a specific payout-provider SDK. The provider-neutral state machine and `PayoutProviderPort` land first; production `PROVIDER` mode remains disabled.
- Non-zero risk reserve percentages. The ledger and APIs support reserves, but the initial configured rate remains zero.
- Destructive removal of dormant `order_svc` finance tables, old seller wallet columns, old processed-event tables, and compatibility endpoints. Removal requires a separate data audit after two stable releases.
- A single cross-service atomic admin dashboard snapshot. Order and finance reports expose independent `asOf` and coverage metadata; the frontend must not pretend those snapshots are transactionally identical.

## Plan Self-Review

- **Spec coverage:** Captures business policy, COD, allocations, versioned events, immutable ledger, releases, refunds, chargebacks, payout security, reporting/search, checkout quote, buyer timeline, frontend, reconciliation, backfill, docs, and E2E.
- **Placeholder scan:** No implementation task depends on a `TBD`, `TODO`, unnamed provider, or unspecified test. Provider execution is deliberately fail-closed and explicitly deferred.
- **Type consistency:** `allocationId`, `allocationVersion`, `adjustmentId`, `reversalId`, `eventId`, `correlationId`, `causationId`, `currency`, and component names are consistent across producers, consumers, persistence, and APIs.
- **Deployment safety:** Consumers and additive schemas land before producers. Legacy paths remain switchable during the observation window. Journal history is never deleted during rollback.

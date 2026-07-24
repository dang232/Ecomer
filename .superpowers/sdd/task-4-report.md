# Task 4 Report — Persist Immutable Per-Sub-Order Financial Allocations

## Delivered

- Added Flyway migration `V31__sub_order_financial_allocations.sql` with immutable financial component columns, UUID allocation IDs, version uniqueness on `(sub_order_id, allocation_version)`, frozen commission metadata, source constraints, and no cross-schema foreign keys.
- Added hexagonal allocation domain types and a persistence output port. The application layer depends only on that port; the JPA adapter is confined to infrastructure.
- Added deterministic allocation policy:
  - coupon discounts are platform-funded;
  - commission bases exclude platform discounts, buyer shipping, and tax;
  - tier rates are frozen at `STANDARD=.10`, `VERIFIED=.08`, `PREFERRED=.05`, and `MALL=.03`;
  - buyer shipping/tax are not initially seller-payable;
  - proportional VND remainders are assigned by ascending generated sub-order ID.
- Wired allocation after `orderRepository.save(...)` and before event publication in the existing `@Transactional` `CreateOrderUseCase.create(...)` boundary.
- Preserved existing `OrderItem` constructor call sites with a compatibility constructor; the allocation dependency on `CreateOrderUseCase` is mandatory and all call sites provide it.
- Added JPA mapping for `orders.tax_total` and `order_items.tax_rate` / `tax_amount`; tax calculation results now persist on the relevant order items.

## TDD Evidence

1. Added `AllocateOrderFinancialsUseCaseTest` and ran it before production allocation classes existed.
   - Command: `./mvnw.cmd "-Dtest=AllocateOrderFinancialsUseCaseTest" test`
   - Result: expected compilation failure because `domain.finance` and `SubOrderFinancialAllocationRepositoryPort` did not exist.
2. Added production implementation and mapping tests.
   - Command: `./mvnw.cmd "-Dtest=AllocateOrderFinancialsUseCaseTest,OrderJpaEntityFinancialMappingTest" test`
   - Result: 3 tests passed.
3. Added the creation-flow sequencing test for allocation persistence after order persistence and before publication.

## Verification

- Complete feasible order-service unit suite before the hardening pass: `./mvnw.cmd "-Dtest=!OrderServiceIntegrationTest,!OrderServiceApplicationTests,*Test" test`
  - Passed: 186 tests, 0 failures, 0 errors.
- The initial focused integration attempt was blocked by the older Testcontainers `1.20.4` BOM and Docker Desktop API detection. The BOM was aligned to `1.21.4` and the focused integration test was rerun successfully with Docker available.
- `git diff --check`
  - Passed (no whitespace errors).

## Reviewer Fixes (2026-07-24)

- Added PostgreSQL `BEFORE UPDATE` and `BEFORE DELETE` triggers to V31, backed by `order_svc.prevent_sub_order_financial_allocations_mutation()`, and removed Lombok mutation setters from the allocation JPA entity. `OrderServiceIntegrationTest.rejectsUpdatesAndDeletesOfFinancialAllocations` inserts a row then proves both mutation paths raise the immutable-row exception.
- Changed financial allocation to take buyer shipping directly from `SubOrder.shippingCost()` and tax directly from each persisted `OrderItem.taxAmount()`. The allocator now checks all four required order-total reconciliations before persistence. An asymmetric regression fixture verifies shipping `9/91` and tax `11/29`, which proportional GMV attribution cannot produce.
- Removed the compatibility `CreateOrderUseCase` constructors that supplied a null allocator; the remaining constructor rejects a null allocation use case, and all source/test creation paths provide one. Checkout test persistence now assigns sub-order IDs before allocation, matching the real persistence boundary.
- Retained the Testcontainers BOM update at `1.21.4`.

### Commands and Results

- `./mvnw.cmd -q "-Dtest=AllocateOrderFinancialsUseCaseTest,CreateOrderUseCaseFinancialAllocationTest" test` — expected RED: 2 failures exposed proportional shipping/tax attribution and nullable allocation dependency.
- `./mvnw.cmd -q "-Dtest=OrderServiceIntegrationTest#rejectsUpdatesAndDeletesOfFinancialAllocations" test` — expected RED: PostgreSQL allowed allocation update before triggers.
- `./mvnw.cmd -q "-Dtest=AllocateOrderFinancialsUseCaseTest,CreateOrderUseCaseFinancialAllocationTest,CheckoutOrderUseCaseTest,OrderJpaEntityFinancialMappingTest" test` — passed.
- `./mvnw.cmd -q "-Dtest=OrderServiceIntegrationTest#rejectsUpdatesAndDeletesOfFinancialAllocations" test` — passed with Docker/Testcontainers available; both database mutations were rejected.
- `./mvnw.cmd -q test` — passed (complete order-service suite, including Docker-backed integration tests).
- `git diff --check` — passed (no whitespace errors).

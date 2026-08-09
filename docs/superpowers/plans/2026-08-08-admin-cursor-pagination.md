# Admin Cursor Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unbounded and deep-offset admin list reads with bounded cursor pagination for orders, users, seller approvals, reviews, disputes, payouts, coupons, and video moderation while keeping the existing admin actions and making the queues usable at mobile widths.

**Architecture:** Each owning service exposes a cursor mode backed by deterministic keyset queries and service-owned composite indexes. The frontend keeps the existing `AdminQueueFrame`, adds a discriminated cursor pagination state with in-memory cursor history, and switches the narrow layout from a fixed-width table to stacked record cards. Existing offset endpoints remain during migration and are removed only after all consumers move to cursor mode.

**Tech Stack:** Spring Boot 4.1 / Java 25, PostgreSQL and Flyway, NestJS 11 where applicable, React 19 / TypeScript / TanStack Query / Zod / Tailwind 4, Vitest, Jest, Maven, Playwright, Docker Compose.

**Design spec:** `docs/superpowers/specs/2026-08-08-admin-cursor-pagination-design.md`

---

## File map and ownership

### Shared contracts and frontend infrastructure

- Modify `fe/src/shared/contracts/api/shared.ts` to formalize the cursor-page schema and common cursor error shape without removing the existing Spring `Page<T>` schema.
- Modify `fe/src/shared/contracts/api/admin.ts` to add the admin cursor-page schema and preserve legacy page parsing during migration.
- Modify `fe/src/shared/api/endpoints/admin.ts` to add typed cursor parameters to every large admin list endpoint and stop using array schemas for the cursor-mode paths.
- Modify `fe/src/features/admin/components/admin-queue-frame.tsx` to render offset or cursor pagination and to host responsive list/card rendering.
- Modify `fe/src/shared/ui/pagination.tsx` only if the existing component cannot express cursor mode cleanly; keep generic consumer behavior unchanged.
- Add focused tests beside each changed shared contract or component.

### Admin feature query and route state

- Modify `fe/src/features/admin/model/admin-queue-route-state.ts` only for filter/sort/page-size URL state; cursor tokens remain in memory and are not placed directly in the URL.
- Modify the query option files for orders, users, sellers, reviews, payouts, disputes, coupons, and video queues under `fe/src/features/*/api/query-options.ts`.
- Modify each queue component under `fe/src/features/admin-*/components/` to pass cursor state, page size, row ranges, and refresh behavior to `AdminQueueFrame`.
- Add mobile row/card renderers near each queue only where the existing columns cannot be represented by a shared generic card.

### Service-owned backend changes

- `services/order-service`: `AdminOrderController`, `AdminDisputeController`, `AdminOrderUseCase`, `ListOpenDisputesUseCase`, repositories/ports, Flyway migrations, and service tests.
- `services/user-service`: `AdminUserController`, `AdminSellerController`, `AdminUserUseCase`, repository ports/adapters, Flyway migrations, and service tests.
- `services/product-service`: `AdminReviewController`, `AdminReviewListUseCase`, `AdminVideoController`, review/video repositories, Flyway migrations, and service tests.
- `services/seller-finance-service`: `AdminFinanceController`, `AdminPayoutReadUseCase`, payout repository, Flyway migrations, and service tests.
- `services/coupon-service`: coupon controller/use case/repository, Flyway migrations, and service tests.
- Gateway routing remains unchanged unless a new path is introduced; if a new path is introduced, update `services/api-gateway/src/main/java/com/vnshop/apigateway/infrastructure/route/RouteConfig.java` and its route test.

### Operational verification

- Add or update `fe/e2e/admin-ui.spec.ts` and focused admin queue specs for cursor navigation and mobile layout.
- Add service-level integration or repository tests for query ordering, `hasMore`, equal timestamps, and filter boundaries.
- Add a repeatable large-fixture/query-plan command under `scripts/` or the owning service test tooling only if an existing fixture utility cannot exercise 10M-scale access paths.

---

## Task 1: Freeze the shared cursor contract with failing tests

**Files:**
- Modify: `fe/src/shared/contracts/api/shared.ts`
- Modify: `fe/src/shared/contracts/api/admin.ts`
- Test: `fe/src/shared/contracts/api/shared.test.ts` or the repository’s existing shared-contract test location
- Test: `fe/src/shared/contracts/api/admin.test.ts` or the repository’s existing admin-contract test location

- [ ] **Step 1: Add failing schema tests for the cursor response.**

  Cover `items`, `nextCursor`, `hasMore`, `pageSize`, `sort`, and optional `snapshot`. Assert that `nextCursor: null` is accepted and that a missing `hasMore` is rejected. Add a test that the stable error payload can represent `cursor_invalid` and `cursor_scope_mismatch`.

- [ ] **Step 2: Run the focused frontend contract tests.**

  Run: `cd fe; pnpm vitest run src/shared/contracts/api/shared.test.ts src/shared/contracts/api/admin.test.ts`

  Expected: the new tests fail because the cursor schemas/types do not yet exist.

- [ ] **Step 3: Implement the generic cursor-page schema and admin cursor-page alias.**

  Preserve `pageSchema` and `adminPageSchema` for offset consumers. Add a typed `cursorPageSchema(item)` using the existing `CursorPage<T>` convention, then add an admin alias that exposes `items`, `nextCursor`, `hasMore`, `pageSize`, `sort`, and `snapshot`.

- [ ] **Step 4: Re-run the focused tests and the TypeScript checker.**

  Run: `cd fe; pnpm vitest run src/shared/contracts/api/shared.test.ts src/shared/contracts/api/admin.test.ts; pnpm run typecheck`

  Expected: all focused tests pass and typecheck exits 0.

- [ ] **Step 5: Commit the shared contract slice.**

  ```bash
  git add fe/src/shared/contracts/api/shared.ts fe/src/shared/contracts/api/admin.ts fe/src/shared/contracts/api/shared.test.ts fe/src/shared/contracts/api/admin.test.ts
  git commit -m "feat(admin): add cursor pagination contracts"
  ```

## Task 2: Add a signed, scoped server cursor codec

**Files:**
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/pagination/AdminCursorCodec.java`
- Create: `services/user-service/src/main/java/com/vnshop/userservice/infrastructure/web/pagination/AdminCursorCodec.java`
- Create: `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/pagination/AdminCursorCodec.java`
- Create: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/web/pagination/AdminCursorCodec.java`
- Create: `services/coupon-service/src/main/java/com/vnshop/couponservice/infrastructure/web/pagination/AdminCursorCodec.java`
- Test: `AdminCursorCodecTest.java` beside each service-local codec
- Modify: each owning service `src/main/resources/application.yml` only when its existing configuration has no admin cursor secret/TTL keys

- [ ] **Step 1: Locate the existing shared security/configuration conventions.**

  Search for HMAC signing, Base64 URL encoding, service properties records, and existing cursor codecs before creating a new utility. Reuse the project convention if present.

- [ ] **Step 2: Add failing tests for codec behavior.**

  Test round-trip encoding, tampering rejection, expiry rejection, resource mismatch, filter-hash mismatch, sort mismatch, and missing required sort-key fields. Use fixed timestamps and a test secret so tests are deterministic.

- [ ] **Step 3: Implement the minimum codec.**

  Encode a versioned JSON payload plus an HMAC signature using URL-safe Base64. Include resource, filter hash, sort definition, last sort key, unique ID, optional `asOf`, and `expiresAt`. Return typed invalid-cursor reasons instead of leaking cryptographic exceptions.

- [ ] **Step 4: Run the codec tests.**

  Run the exact test command for the selected service-common module, for example `./mvnw -Dtest=AdminCursorCodecTest test` from the owning Maven module.

  Expected: all cursor security tests pass.

- [ ] **Step 5: Commit the codec independently.**

  ```bash
  git add services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/pagination services/order-service/src/test/java/com/vnshop/orderservice/infrastructure/web/pagination services/user-service/src/main/java/com/vnshop/userservice/infrastructure/web/pagination services/user-service/src/test/java/com/vnshop/userservice/infrastructure/web/pagination services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/pagination services/product-service/src/test/java/com/vnshop/productservice/infrastructure/web/pagination services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/web/pagination services/seller-finance-service/src/test/java/com/vnshop/sellerfinanceservice/infrastructure/web/pagination services/coupon-service/src/main/java/com/vnshop/couponservice/infrastructure/web/pagination services/coupon-service/src/test/java/com/vnshop/couponservice/infrastructure/web/pagination
  git commit -m "feat(admin): add scoped cursor codec"
  ```

## Task 3: Implement orders and disputes cursor reads in order-service

**Files:**
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/AdminOrderController.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/AdminDisputeController.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/application/AdminOrderUseCase.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/application/ListOpenDisputesUseCase.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/persistence/` repository port and adapter files that currently implement `AdminOrderUseCase` and `ListOpenDisputesUseCase`
- Create: next Flyway migration under `services/order-service/src/main/resources/db/migration/`
- Test: controller/use-case/repository tests for both resources

- [ ] **Step 1: Add failing order cursor tests.**

  Prove default newest-first ordering, equal-timestamp ID tie-breaking, status and query filters, `limit + 1` `hasMore`, and cursor scope rejection. Prove that the endpoint does not call the count-based `Page<T>` path in cursor mode.

- [ ] **Step 2: Add the order composite indexes.**

  Add the actual table/column names for `(status, created_at DESC, id DESC)` and `(created_at DESC, id DESC)` in a new migration. Use the project’s Flyway and deployment-safe index convention; do not invent a second migration version.

- [ ] **Step 3: Implement the order cursor query and endpoint mode.**

  Accept `limit` and `cursor`, validate filters/sort, decode the cursor, query one extra row with keyset predicates, encode the next cursor, and return the cursor response. Keep the existing offset response when `page` or `size` is explicitly used during migration.

- [ ] **Step 4: Add failing and then passing dispute cursor tests.**

  Replace the unbounded open-dispute read only in cursor mode. Add status/created-at/ID ordering, search filter handling, `hasMore`, and mutation-safe empty-page behavior at the use-case boundary.

- [ ] **Step 5: Run order-service verification.**

  Run the focused Maven tests first, then the service’s standard unit suite. Inspect generated SQL or repository query plans where integration infrastructure is available.

- [ ] **Step 6: Commit the order-service slice.**

  ```bash
  git add services/order-service
  git commit -m "feat(order): add cursor pagination for admin queues"
  ```

## Task 4: Implement users and seller approvals cursor reads in user-service

**Files:**
- Modify: `services/user-service/src/main/java/com/vnshop/userservice/infrastructure/web/AdminUserController.java`
- Modify: `services/user-service/src/main/java/com/vnshop/userservice/infrastructure/web/AdminSellerController.java`
- Modify: `services/user-service/src/main/java/com/vnshop/userservice/application/AdminUserUseCase.java`
- Modify: `services/user-service/src/main/java/com/vnshop/userservice/infrastructure/persistence/UserJpaRepository.java`, `services/user-service/src/main/java/com/vnshop/userservice/domain/port/out/UserRepositoryPort.java`, and the admin seller repository files under `services/user-service/src/main/java/com/vnshop/userservice/infrastructure/persistence/`
- Create: next Flyway migrations under `services/user-service/src/main/resources/db/migration/`
- Test: admin user/seller controller, use-case, repository, and cursor contract tests

- [ ] **Step 1: Add failing user cursor tests.**

  Cover default `created_at DESC, id DESC`, optional normalized-name ordering, prefix search behavior, filter hash binding, `hasMore`, and page-size limits.

- [ ] **Step 2: Add the actual user and seller indexes.**

  Add `(created_at DESC, id DESC)` and the normalized-name/ID index only if the corresponding normalized column exists. If it does not exist, add a migration for a deterministic normalized field or use the existing searchable field and document the query limitation in the implementation commit.

- [ ] **Step 3: Implement cursor mode while preserving explicit offset compatibility.**

  Keep `Page<T>` for legacy callers, but use the cursor response when `cursor` or `limit` is supplied by the new frontend.

- [ ] **Step 4: Run user-service focused tests and the standard service suite.**

  Expected: cursor contract tests, repository tests, and existing admin tests pass.

- [ ] **Step 5: Commit the user-service slice.**

  ```bash
  git add services/user-service
  git commit -m "feat(user): add cursor pagination for admin queues"
  ```

## Task 5: Implement reviews and video moderation cursor reads in product-service

**Files:**
- Modify: `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/review/AdminReviewController.java`
- Modify: `services/product-service/src/main/java/com/vnshop/productservice/application/review/AdminReviewListUseCase.java`
- Modify: `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/AdminVideoController.java`
- Modify: `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/persistence/review/ReviewJpaSpringDataRepository.java`, the review repository port/adapter files under `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/persistence/review/`, and the video repository files under `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/persistence/video/`
- Create: next Flyway migrations under `services/product-service/src/main/resources/db/migration/`
- Test: admin review/video controller, use-case, repository, and cursor tests

- [ ] **Step 1: Add failing review cursor tests.**

  Cover pending-status filtering, query filtering, `created_at DESC, review_id DESC`, equal timestamps, and no full-list enrichment before pagination.

- [ ] **Step 2: Add failing video cursor tests.**

  Cover pending-review and appeal-pending status filters, `created_at` plus video ID ordering, page-size bounds, and next-cursor generation.

- [ ] **Step 3: Implement repository-level keyset queries before enrichment.**

  Fetch only the bounded row set, then enrich only those rows. Do not load all pending rows and paginate in memory.

- [ ] **Step 4: Add/verify status-created-ID indexes.**

  Use the existing review pagination index pattern as the model, and add the video status-created-ID index with the actual entity ID column.

- [ ] **Step 5: Run product-service focused tests and the standard service suite.**

- [ ] **Step 6: Commit the product-service slice.**

  ```bash
  git add services/product-service
  git commit -m "feat(product): add cursor pagination for admin queues"
  ```

## Task 6: Implement payouts and coupons cursor reads

**Files:**
- Modify: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/web/AdminFinanceController.java`
- Modify: `services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/application/AdminPayoutReadUseCase.java`
- Modify: payout repository and Flyway migration under `services/seller-finance-service/src/main/resources/db/migration/`
- Modify: coupon controller/use case/repository and migration under `services/coupon-service/`
- Test: payout/coupon cursor contract, repository, and controller tests

- [ ] **Step 1: Add failing payout cursor tests.**

  Cover status filters, seller search, newest-first payout ID ordering, exact-page and short-page `hasMore`, and bounded seller enrichment.

- [ ] **Step 2: Implement cursor mode for pending, completed, and all payout reads.**

  Remove unbounded array behavior from the new frontend path. Preserve legacy endpoints only for compatibility and route new calls through the bounded response.

- [ ] **Step 3: Add failing coupon cursor tests and implement cursor mode.**

  Use deterministic created-at/ID ordering and active/status filters. Keep coupon writes unchanged.

- [ ] **Step 4: Add payout and coupon composite indexes.**

  Use actual table names and status columns. Verify that the status-filtered query can use the leading index columns.

- [ ] **Step 5: Run both service suites and commit separately by service.**

  ```bash
  git add services/seller-finance-service
  git commit -m "feat(finance): add cursor pagination for admin payouts"

  git add services/coupon-service
  git commit -m "feat(coupon): add cursor pagination for admin coupons"
  ```

## Task 7: Wire frontend endpoint schemas and query options

**Files:**
- Modify: `fe/src/shared/api/endpoints/admin.ts`
- Modify: `fe/src/features/admin-orders/api/query-options.ts`
- Modify: `fe/src/features/admin-users/api/query-options.ts`
- Modify: `fe/src/features/admin-sellers/api/query-options.ts`
- Modify: `fe/src/features/admin-reviews/api/query-options.ts`
- Modify: `fe/src/features/admin-disputes/api/query-options.ts`
- Modify: `fe/src/features/admin-payouts/api/query-options.ts`
- Modify: coupon/video query option files under `fe/src/features/admin-*/api/`
- Test: endpoint and query-option tests for each cursor-enabled resource

- [ ] **Step 1: Add failing endpoint tests.**

  Assert each cursor request sends `limit`, `cursor`, filters, and sort without `page`/`size`. Assert the response is parsed as a cursor page, not an array.

- [ ] **Step 2: Implement typed cursor endpoint functions.**

  Keep existing offset functions for compatibility. Add cursor parameters with stable defaults and a common response schema.

- [ ] **Step 3: Add cursor-aware query keys.**

  Include resource, filter values, sort, page size, and cursor. Use `placeholderData` or the project’s equivalent to keep the current page visible while the next page loads.

- [ ] **Step 4: Reset cursor state on filter/sort/page-size changes.**

  Keep filters in route state, keep cursor history in the queue component/hook, and abort stale requests through the existing API signal support.

- [ ] **Step 5: Run frontend endpoint/query tests and typecheck.**

  Run: `cd fe; pnpm vitest run src/shared/api/endpoints src/features/admin-*/api; pnpm run typecheck`

- [ ] **Step 6: Commit the endpoint/query slice.**

  ```bash
  git add fe/src/shared/api/endpoints/admin.ts fe/src/features/admin-*/api
  git commit -m "feat(admin): wire cursor queue queries"
  ```

## Task 8: Update AdminQueueFrame and cursor controls

**Files:**
- Modify: `fe/src/features/admin/components/admin-queue-frame.tsx`
- Modify: `fe/src/shared/ui/pagination.tsx` if needed
- Create: `fe/src/shared/ui/cursor-pagination.tsx` if separating cursor controls improves component responsibility
- Test: `fe/src/features/admin/components/admin-queue-frame.test.tsx`
- Test: shared pagination component tests

- [ ] **Step 1: Add failing frame tests.**

  Assert cursor mode renders range text, Previous/Next, Refresh, page-size selection, disabled states, and no `Page N of M`. Preserve offset mode tests for legacy queues.

- [ ] **Step 2: Implement the discriminated pagination state.**

  Support `{ kind: "offset", ... }` and `{ kind: "cursor", ... }` without allowing a cursor state to access `totalPages`.

- [ ] **Step 3: Add cursor history behavior.**

  Store the previous cursor for each forward traversal. Previous returns to the prior cursor/filter scope; changing any filter, sort, or page size clears the history.

- [ ] **Step 4: Add loading/error/invalid-cursor/empty states.**

  Render retryable errors with the existing error surface and a cursor reset action for invalid/expired cursors. Never issue an unbounded fallback request.

- [ ] **Step 5: Run frame and shared UI tests.**

  Expected: existing offset pagination tests remain green and new cursor tests pass.

- [ ] **Step 6: Commit the shared frame slice.**

  ```bash
  git add fe/src/features/admin/components/admin-queue-frame.tsx fe/src/shared/ui
  git commit -m "feat(admin): add cursor queue controls"
  ```

## Task 9: Add responsive mobile record cards

**Files:**
- Modify: `fe/src/features/admin/components/admin-queue-frame.tsx`
- Create or modify: queue-specific mobile row renderers under `fe/src/features/admin-*/components/`
- Modify: shared table/card styles only where existing design tokens support the layout
- Test: queue component tests at mobile semantics

- [ ] **Step 1: Add failing mobile tests.**

  Render representative rows at a 390px viewport and assert the table does not force a horizontal fixed-width container, primary fields are visible, and secondary details remain available through the drawer.

- [ ] **Step 2: Implement the responsive presentation.**

  Keep desktop tables at large widths. At narrow widths render stacked cards with the existing typography, spacing, borders, focus states, and row-open behavior.

- [ ] **Step 3: Keep pagination inside the content width.**

  Use a compact footer with the current row range and Previous/Next controls. Do not render a wide table wrapper around the pagination.

- [ ] **Step 4: Run frontend tests and visual browser checks.**

  Expected: no horizontal overflow at 390px; the 1280px table remains usable.

- [ ] **Step 5: Commit the responsive UI slice.**

  ```bash
  git add fe/src/features/admin fe/src/shared/ui
  git commit -m "fix(admin): make queue pagination mobile friendly"
  ```

## Task 10: Add rollout flags and migration compatibility

**Files:**
- Modify: the existing frontend/runtime configuration convention used for feature flags
- Modify: service configuration properties for cursor mode
- Modify: admin endpoint documentation if present
- Test: flag-enabled and flag-disabled contract tests

- [ ] **Step 1: Add one named flag per rollout boundary.**

  Use a consistent convention such as `admin.cursorPagination.<resource>` or the project’s existing centralized configuration keys. Default flags to disabled for production until the corresponding service and frontend code are deployed together.

- [ ] **Step 2: Implement dual-read compatibility.**

  Flag enabled: frontend sends cursor requests and parses cursor responses. Flag disabled: existing offset/legacy behavior remains available. Do not silently parse an unbounded array in cursor mode.

- [ ] **Step 3: Add flag tests and document rollback.**

  Verify that disabling a resource flag returns that resource to the known offset path without affecting other queues. Document that rollback does not remove indexes or invalidate existing cursors.

- [ ] **Step 4: Commit the migration slice.**

  ```bash
  git add services/order-service/src/main/resources/application.yml services/user-service/src/main/resources/application.yml services/product-service/src/main/resources/application.yml services/seller-finance-service/src/main/resources/application.yml services/coupon-service/src/main/resources/application.yml fe/src/app/hooks/use-app-config.ts fe/public/runtime-config.json docs/CI-PIPELINE.md
  git commit -m "feat(admin): gate cursor pagination rollout"
  ```

## Task 11: Add observability and database protection

**Files:**
- Modify: owning service metrics/instrumentation locations found during implementation
- Modify: service configuration for bounded query timeout and page-size maximum
- Test: metric-name/label contract tests where the project has metric tests
- Modify: operational documentation with dashboard/runbook entries

- [ ] **Step 1: Add bounded metrics.**

  Emit `admin_list_requests_total`, `admin_list_request_duration_seconds`, `admin_list_cursor_invalid_total`, `admin_list_page_size`, `admin_list_has_more_total`, and `admin_list_db_timeout_total` with only low-cardinality resource/status/reason labels.

- [ ] **Step 2: Add query timeout and input caps.**

  Enforce default page size 50, maximum 100, allowed sort fields, and the service’s bounded database query timeout. Return the stable error envelope instead of allowing an unbounded request.

- [ ] **Step 3: Add operational verification.**

  Confirm p95/p99 latency, timeout rate, invalid-cursor rate, page-size distribution, and connection-pool saturation are visible in the existing Prometheus/Grafana stack without high-cardinality labels.

- [ ] **Step 4: Commit observability changes.**

  ```bash
  git add services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/metrics services/user-service/src/main/java/com/vnshop/userservice/infrastructure/metrics services/product-service/src/main/java/com/vnshop/productservice/infrastructure/metrics services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/metrics services/coupon-service/src/main/java/com/vnshop/couponservice/infrastructure/metrics docs/CI-PIPELINE.md
  git commit -m "feat(admin): observe cursor pagination health"
  ```

## Task 12: Add browser and large-fixture verification

**Files:**
- Modify: `fe/e2e/admin-ui.spec.ts`
- Add or modify: focused admin cursor Playwright spec under `fe/e2e/`
- Add or modify: service repository/integration fixtures and query-plan verification tooling
- Modify: `docs/CI-PIPELINE.md` only if a new non-Docker verification command is added

- [ ] **Step 1: Add failing browser tests for cursor navigation.**

  Mock or seed a response with two cursor pages and assert Next, Previous, filter reset, refresh, loading, empty, and invalid-cursor recovery behavior.

- [ ] **Step 2: Add responsive browser assertions.**

  At 390px assert the admin queue stays within the viewport and uses the card presentation. At 1280px assert the desktop table and cursor footer are visible.

- [ ] **Step 3: Add mutation-refresh coverage.**

  Approve/reject/resolve a row and assert the current cursor page is refreshed with filters preserved and no unbounded request occurs.

- [ ] **Step 4: Add representative large-fixture query verification.**

  Use service-owned fixtures or a temporary PostgreSQL dataset to verify that the cursor query returns the correct boundary rows, uses the composite index in `EXPLAIN (ANALYZE, BUFFERS)`, and does not issue an exact count. Verify a deep traversal page has bounded work comparable to the first page.

- [ ] **Step 5: Run the complete frontend verification and affected service suites.**

  Run: `cd fe; pnpm run verify; pnpm exec playwright test e2e/admin-ui.spec.ts`

  Run the focused Maven/Jest suites for every changed service, then the repository’s affected-service CI commands.

- [ ] **Step 6: Commit the verification slice.**

  ```bash
  git add fe/e2e/admin-ui.spec.ts fe/e2e/admin-cursor-pagination.spec.ts services/order-service/src/test services/user-service/src/test services/product-service/src/test services/seller-finance-service/src/test services/coupon-service/src/test docs/CI-PIPELINE.md
  git commit -m "test(admin): verify cursor pagination at scale"
  ```

## Task 13: Roll out, monitor, and retire legacy reads

**Files:**
- Modify: rollout configuration for each resource
- Modify: admin API documentation and migration notes
- Delete or deprecate: unbounded frontend endpoint paths only after all consumers are migrated
- Test: release smoke and rollback checks

- [ ] **Step 1: Enable cursor mode for orders and users.**

  Confirm service health, endpoint contract, query plans, and browser behavior before enabling the next resource.

- [ ] **Step 2: Enable sellers, reviews, disputes, payouts, coupons, and video queues in batches.**

  After each batch, inspect list p95/p99, database timeout rate, cursor-invalid rate, and connection-pool saturation. Roll back only the affected resource flag if metrics regress.

- [ ] **Step 3: Remove unbounded frontend calls.**

  Search for all array-schema calls to the migrated admin paths. Replace each remaining consumer or explicitly keep it as a documented write-adjacent compatibility call.

- [ ] **Step 4: Retire offset mode only after consumer inventory is empty.**

  Keep the backend offset path until the consumer inventory and release evidence show no remaining callers. Remove it in a separate cleanup change, not in the initial rollout.

- [ ] **Step 5: Run final release verification.**

  Run frontend verification, focused browser admin journeys, all affected service suites, query-plan checks, and the required `VNShop CI / CI Gate` on the release pull request.

---

## Final acceptance checklist

- [ ] All eight selected admin list surfaces have bounded cursor reads.
- [ ] No normal cursor request performs an exact count or unbounded fetch.
- [ ] Every cursor has deterministic sort keys, scope binding, signing, and expiry.
- [ ] Composite indexes exist and query plans use them.
- [ ] Frontend filters, sort, page size, Next, Previous, refresh, and mutations preserve cursor state correctly.
- [ ] Desktop and 390px mobile browser checks pass.
- [ ] Cursor errors, database timeouts, rate limits, and retries are observable and bounded.
- [ ] Offset compatibility remains only where explicitly documented.
- [ ] Full frontend verification, affected service suites, and the protected CI gate pass.

# Task 2 Boundary And Type-Safety Report

Date: 2026-08-01
Plan: `docs/superpowers/plans/2026-08-01-web-commerce-modernization-completion.md`
Task: Source-boundary and type-safety cleanup for Plan 03/07 acceptance gates
Status: BLOCKED

## What I attempted

I followed the repo instructions first by reading:

- `.agents/AGENTS.md`
- `.agents/fe/AGENTS.md`
- `services/AGENTS.md`
- `docs/superpowers/plans/2026-08-01-web-commerce-modernization-completion.md`

Then I ran the required acceptance inventory commands from `fe` exactly as requested:

- `pnpm run lint:boundaries`
- `pnpm run lint:type-safety`

## Gate results

### `pnpm run lint:boundaries`

Exit code: `1`

Reported findings:

- `src/app/layouts/SellerLayout.tsx: app must import features through their public index: @/features/seller/components/seller-nav`
- `src/features/admin-dashboard/components/marketplace-kpis.tsx: features must consume shared modules instead of app internals: @/app/components/kpi-card`
- `src/features/admin-disputes/components/dispute-queue.tsx: cross-feature imports must use the feature public index: ../../admin/components/admin-queue-frame`
- `src/features/admin-orders/components/order-queue.tsx: cross-feature imports must use the feature public index: ../../admin/components/admin-queue-frame`
- `src/features/admin-payouts/components/payout-queue.tsx: cross-feature imports must use the feature public index: @/features/admin/components/admin-queue-frame`
- `src/features/admin-payouts/components/payout-queue.tsx: cross-feature imports must use the feature public index: @/features/admin/model/queue-capabilities`
- `src/features/admin-reviews/components/review-moderation-queue.tsx: cross-feature imports must use the feature public index: ../../admin/components/admin-queue-frame`
- `src/features/admin-sellers/components/seller-approval-queue.tsx: cross-feature imports must use the feature public index: ../../admin/components/admin-queue-frame`
- `src/features/seller-dashboard/components/seller-dashboard-route.tsx: features must consume shared modules instead of app internals: @/app/hooks/use-seller-revenue`
- `src/features/seller-products/api/query-options.ts: features must consume shared modules instead of app internals: @/app/hooks/use-products`
- `src/features/seller-products/components/product-list.tsx: features must consume shared modules instead of app internals: @/app/hooks/use-debounced-value`
- `src/features/seller-products/components/product-list.tsx: features must consume shared modules instead of app internals: @/app/hooks/use-products`

### `pnpm run lint:type-safety`

Exit code: `1`

Reported findings:

- `app/lib/api/client.ts:40 lint suppression`
- `app/lib/api/envelope.ts:6 double assertion`
- `app/lib/api/telemetry-store.ts:39 lint suppression`
- `features/admin/components/admin-record-drawer.tsx:25 lint suppression`
- `features/admin-coupons/components/coupon-list.tsx:140 lint suppression`
- `features/admin-coupons/components/coupon-list.tsx:142 lint suppression`
- `features/admin-dashboard/components/marketplace-kpis.tsx:10 lint suppression`
- `features/admin-health/model/health-view.ts:86 response.json assertion`
- `features/admin-orders/components/order-queue.tsx:180 non-null assertion`
- `features/admin-video/components/video-preview-drawer.tsx:37 non-null assertion`
- `features/seller-orders/components/order-detail-drawer.tsx:54 lint suppression`
- `features/seller-products/components/product-list.tsx:50 lint suppression`
- `features/seller-products/components/product-list.tsx:75 lint suppression`
- `features/seller-products/components/product-list.tsx:85 lint suppression`
- `features/seller-products/components/product-list.tsx:95 lint suppression`
- `features/seller-products/components/product-list.tsx:107 lint suppression`
- `shared/auth/native-auth.ts:173 JSON.parse assertion`
- `shared/auth/native-auth.ts:234 JSON.parse assertion`

## Blocking condition

The live `lint:boundaries` inventory in this checkout includes several failing source files outside the user-approved edit fence:

- `src/app/layouts/SellerLayout.tsx`
- `src/features/admin-disputes/components/dispute-queue.tsx`
- `src/features/admin-payouts/components/payout-queue.tsx`
- `src/features/admin-reviews/components/review-moderation-queue.tsx`
- `src/features/admin-sellers/components/seller-approval-queue.tsx`
- `src/features/seller-dashboard/components/seller-dashboard-route.tsx`

I inspected `fe/scripts/check-boundaries.mjs` to verify whether these could be fixed indirectly through public exports alone. They cannot. The checker fails on the import specifier string in the consuming file:

- app-to-feature imports pass only when app imports the feature public index, not a deep subpath
- cross-feature imports pass only when the importing feature uses the target feature public index, not a deep subpath
- feature-to-app imports fail whenever a feature imports any `src/app/*` module

Because of that rule shape, those out-of-scope findings require direct edits in the listed consumer files themselves. Adding or changing public indexes/shared hooks is necessary for some of the allowed files, but it is not sufficient to clear the unrelated current failures.

Under the stated constraint:

> Allowed source files are only the files named by those two current gate outputs ... plus the exact public-index or shared hook files needed to resolve the boundary imports.

I cannot make both acceptance gates pass without violating the allowed-file fence, because the current boundary inventory is broader than the allowlist.

## TDD evidence

Not applicable. I did not begin production edits because acceptance is blocked by the current workspace scope mismatch before a valid red-to-green implementation loop can start.

## Files changed

- `.superpowers/sdd/2026-08-01-web-commerce-modernization-completion/task-2-boundary-report.md`

## Self-review findings

- The blocker is reproducible and grounded in current command output.
- The reason acceptance is unreachable is structural, not a matter of implementation preference.
- I did not weaken or modify the boundary or type-safety gates.

## Concerns

- The worktree is already heavily dirty, and several of the additional boundary failures are in files already modified outside this task.
- To complete Task 2 honestly, the allowed source fence needs to be widened to include every current boundary failure, or the checkout must be restored to the expected inventory before re-running the task.

---

## Resume Update - 2026-08-01

Status: DONE

The user widened the approved scope to include the live `lint:boundaries` inventory. I resumed the task, implemented the boundary/type-safety fixes, reran the scoped tests, and reran the two acceptance gates.

### What I implemented

- Switched app/feature and cross-feature imports to public feature indexes:
  - `fe/src/app/layouts/SellerLayout.tsx`
  - `fe/src/features/admin-disputes/components/dispute-queue.tsx`
  - `fe/src/features/admin-orders/components/order-queue.tsx`
  - `fe/src/features/admin-payouts/components/payout-queue.tsx`
  - `fe/src/features/admin-reviews/components/review-moderation-queue.tsx`
  - `fe/src/features/admin-sellers/components/seller-approval-queue.tsx`
  - `fe/src/features/seller/index.ts`

- Removed feature-to-app boundary violations by replacing app-hook dependencies with compliant feature/shared usage:
  - `fe/src/features/seller-products/api/query-options.ts`
  - `fe/src/features/seller-products/components/product-list.tsx`
  - `fe/src/features/seller-dashboard/components/seller-dashboard-route.tsx`
  - `fe/src/features/admin-dashboard/components/marketplace-kpis.tsx`

- Removed the type-safety findings without weakening the gates:
  - `fe/src/app/lib/api/client.ts` - removed the `any`-based suppression and kept the refresh-lock timestamp typed
  - `fe/src/app/lib/api/envelope.ts` - removed the double assertion by using a typed generic schema factory
  - `fe/src/app/lib/api/telemetry-store.ts` - removed the lint suppression
  - `fe/src/features/admin/components/admin-record-drawer.tsx` - used the `footer` prop instead of suppressing the unused value
  - `fe/src/features/admin-coupons/components/coupon-list.tsx` - removed inline lint suppressions
  - `fe/src/features/admin-health/model/health-view.ts` - replaced direct `response.json()` assertion flow with the existing `readJson` helper
  - `fe/src/features/admin-orders/components/order-queue.tsx` - removed the non-null assertion on `dialog.variant`
  - `fe/src/features/admin-video/components/video-preview-drawer.tsx` - removed the non-null assertion on `video.videoId`
  - `fe/src/features/seller-orders/components/order-detail-drawer.tsx` - removed the lint suppression
  - `fe/src/shared/auth/native-auth.ts` - replaced `JSON.parse` assertions with the existing `readJsonText` helper

### Focused test updates

I added focused health-model tests before the production change to pin the behavior that invalid health payloads fail safely while preserving the HTTP status code:

- `fe/src/features/admin-health/model/health-view.test.ts`

I also updated the seller-product list test to match the preserved fallback rendering in the refactored list component:

- `fe/src/features/seller-products/components/product-list.test.tsx`

### Verification

Focused tests run from `fe`:

- Command:
  `pnpm exec vitest run src/app/lib/api/client.test.ts src/app/lib/api/envelope.test.ts src/app/lib/api/telemetry-store.test.ts src/shared/auth/native-auth.test.ts src/features/admin-health/model/health-view.test.ts src/features/admin-orders/components/order-queue.test.tsx src/features/seller-products/components/product-list.test.tsx`
- Result:
  `7` test files passed, `53` tests passed, exit code `0`

Acceptance gates run from `fe`:

- `pnpm run lint:boundaries` -> exit code `0`
- `pnpm run lint:type-safety` -> exit code `0`

### Residual findings

- Scoped boundary gate findings: none
- Scoped type-safety gate findings: none
- Full repository suite: not run in this pass, per user instruction not to wait on the full repository suite

### Files changed in the completed pass

- `.superpowers/sdd/2026-08-01-web-commerce-modernization-completion/task-2-boundary-report.md`
- `fe/src/app/lib/api/client.ts`
- `fe/src/app/lib/api/envelope.ts`
- `fe/src/app/lib/api/telemetry-store.ts`
- `fe/src/app/layouts/SellerLayout.tsx`
- `fe/src/features/admin/components/admin-record-drawer.tsx`
- `fe/src/features/admin-coupons/components/coupon-list.tsx`
- `fe/src/features/admin-dashboard/components/marketplace-kpis.tsx`
- `fe/src/features/admin-disputes/components/dispute-queue.tsx`
- `fe/src/features/admin-health/model/health-view.ts`
- `fe/src/features/admin-health/model/health-view.test.ts`
- `fe/src/features/admin-orders/components/order-queue.tsx`
- `fe/src/features/admin-payouts/components/payout-queue.tsx`
- `fe/src/features/admin-reviews/components/review-moderation-queue.tsx`
- `fe/src/features/admin-sellers/components/seller-approval-queue.tsx`
- `fe/src/features/admin-video/components/video-preview-drawer.tsx`
- `fe/src/features/seller-dashboard/components/seller-dashboard-route.tsx`
- `fe/src/features/seller-orders/components/order-detail-drawer.tsx`
- `fe/src/features/seller-products/api/query-options.ts`
- `fe/src/features/seller-products/components/product-list.tsx`
- `fe/src/features/seller-products/components/product-list.test.tsx`
- `fe/src/features/seller/index.ts`
- `fe/src/shared/auth/native-auth.ts`

---

## Fix Round 1 - 2026-08-01

Status: DONE

### What changed

- Added a regression test in `fe/src/app/lib/api/client.test.ts` for two same-tab authenticated requests that both receive `401` while a single refresh is in flight.
- Updated `fe/src/app/lib/api/client.ts` so a second same-tab authenticated `401` waits on the in-flight refresh result, then retries once with the refreshed token instead of immediately dispatching `auth:unauthorized`.
- Preserved the existing cross-tab BroadcastChannel coordination and the single post-refresh retry behavior.

### TDD Evidence

RED

- Command:
  `pnpm exec vitest run src/app/lib/api/client.test.ts src/app/lib/api/interceptors.test.ts`
- Relevant failing output:
  - `FAIL src/app/lib/api/client.test.ts > request > waits for an in-flight same-tab refresh before retrying a second authenticated 401`
  - `AssertionError: promise rejected "ApiError: Authentication required" instead of resolving`
  - Unhandled rejection surfaced from `src/app/lib/api/client.ts`
- Why this was expected:
  The current same-tab branch treated a second authenticated `401` during `thisTabRefreshing === true` as an immediate auth failure instead of waiting for the refresh started by the first request.

GREEN

- Command:
  `pnpm exec vitest run src/app/lib/api/client.test.ts src/app/lib/api/interceptors.test.ts`
- Result:
  `2` test files passed, `42` tests passed, exit code `0`

### Verification

- `pnpm run lint:boundaries` -> exit code `0`
- `pnpm run lint:type-safety` -> exit code `0`

### Files changed in fix round 1

- `.superpowers/sdd/2026-08-01-web-commerce-modernization-completion/task-2-boundary-report.md`
- `fe/src/app/lib/api/client.ts`
- `fe/src/app/lib/api/client.test.ts`

### Residual findings

- Focused client/interceptor tests: none
- Scoped boundary gate findings: none
- Scoped type-safety gate findings: none

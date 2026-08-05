# VNShop Web Commerce Modernization Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining local buyer and release-cutover work from the 2026-07-29 modernization plan and produce a fully tested committed release candidate.

**Architecture:** Keep the existing route/layout/feature/shared dependency direction. Add typed buyer account, order, and return presenters behind feature public indexes, then remove old compatibility implementations only after route imports are migrated. Verify the exact committed source with the existing frontend build and release gates.

**Tech Stack:** React 19, TypeScript, TanStack Query, React Hook Form, Zod, Vitest, Playwright, Vite, pnpm 9.15.9.

## Global Constraints

- Preserve existing public URLs, gateway authentication, roles, API envelopes, payment semantics, and backend-supported actions.
- Accept network and storage data as `unknown` and validate it with Zod before domain use.
- Keep server state in TanStack Query, navigable state in the URL, display preferences in Zustand, and form state in React Hook Form.
- Do not add controls without an existing endpoint and decoded endpoint input.
- Keep the existing dirty worktree intact; stage only reviewed owned paths.
- Do not claim external staging or production verification without fresh evidence from the protected environment.

---

### Task 1: Complete Buyer Account, Order, Return, And Communication Features

**Files:**
- Create: `fe/src/features/account/model/account-route-state.ts`
- Create: `fe/src/features/account/components/account-nav.tsx`
- Create: `fe/src/features/account/index.ts`
- Create: `fe/src/features/orders/model/order-view.ts`
- Create: `fe/src/features/orders/model/order-view.test.ts`
- Create: `fe/src/features/orders/components/order-list.tsx`
- Create: `fe/src/features/orders/components/order-detail.tsx`
- Create: `fe/src/features/orders/components/order-timeline.tsx`
- Create: `fe/src/features/orders/index.ts`
- Create: `fe/src/features/returns/components/return-workflow.tsx`
- Create: `fe/src/features/returns/index.ts`
- Modify: `fe/src/shared/contracts/api/order.ts`
- Modify: `fe/src/shared/contracts/api/order.test.ts`
- Modify: `fe/src/app/pages/OrdersPage.tsx`
- Modify: `fe/src/app/pages/OrderDetailPage.tsx`
- Modify: `fe/src/app/pages/ReturnRequestPage.tsx`
- Modify: `fe/src/app/pages/ReturnStatusPage.tsx`
- Modify: `fe/src/app/pages/ProfilePage.tsx`
- Modify: `fe/src/app/pages/WishlistPage.tsx`
- Modify: `fe/src/app/pages/NotificationsPage.tsx`
- Modify: `fe/src/app/components/notifications/notification-preferences-page.tsx`
- Create: `fe/src/app/components/notifications/notification-preferences-page.test.tsx`
- Modify: `fe/src/app/pages/MessagesPage.tsx`
- Modify: `fe/src/app/pages/SellerDetailPage.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`

**Interfaces:**
- `toOrderView` accepts decoded order detail plus an optional same-ID decoded list summary and returns truthful actions, financials, and timeline state.
- `AccountNav` owns URL links for profile, wishlist, notifications, messages, and returns without hiding top-level routes in memory.
- `ReturnWorkflow` uses only existing return endpoints and validates the selected item and reason locally.

- [ ] **Step 1: Add failing presenter tests**

  Add tests for pending cancellation, delivered return/buy-again actions, and a detail response that omits unsupported timestamps.

- [ ] **Step 2: Implement decoded order and account view models**

  Split list-summary and detail contracts where required, keep seller names optional, and export only public feature APIs.

- [ ] **Step 3: Compose the buyer routes**

  Replace page-local order, return, account, notification, messaging, and seller-detail presentation with the feature presenters while preserving the current paths and async states.

- [ ] **Step 4: Verify the focused buyer suite**

  Run `pnpm exec vitest run src/features/orders src/features/account src/features/returns src/app/pages/OrdersPage.test.tsx src/app/pages/ReturnRequestPage.test.tsx src/app/pages/ReturnStatusPage.test.tsx src/app/pages/ProfilePage.test.tsx src/app/components/notifications/notification-preferences-page.test.tsx src/app/hooks/use-notifications.test.tsx src/app/hooks/use-messages.test.tsx` from `fe` and require exit code 0.

- [ ] **Step 5: Commit the reviewed buyer slice**

  Stage only the exact reviewed files and commit with `feat(fe): complete buyer account journeys`.

### Task 2: Finish Compiler-Safe Generation Cutover

**Files:**
- Modify: `fe/src/app/pages/MessagesPage.tsx`
- Modify: `fe/src/app/pages/seller/SellerDashboard.tsx`
- Modify: `fe/src/features/seller-orders/components/order-detail-drawer.tsx`
- Modify: `fe/src/app/routes.ts`
- Modify: `fe/src/app/layouts/StorefrontLayout.tsx`
- Modify: `fe/src/app/layouts/SellerLayout.tsx`
- Modify: `fe/src/app/layouts/AdminLayout.tsx`
- Modify: `fe/vite.config.ts`
- Modify: `fe/package.json`
- Modify: `fe/pnpm-lock.yaml`
- Modify: `fe/e2e/release-contract.spec.ts`
- Create: `fe/scripts/check-cutover.test.mjs`
- Create: `fe/scripts/run-cutover-gate.ps1`
- Delete after import migration: `fe/src/app/components/ui/*` compatibility modules, old page wrappers, and old generation-only components listed in Plan 07 Task 4.

**Interfaces:**
- Production source contains no `__commercePreview`, `commerce-preview`, `currentGeneration`, Tabler, Figma asset resolver, or old app UI compatibility imports.
- `run-cutover-gate.ps1` accepts an image reference and expected source commit, verifies OCI provenance, and runs the complete local gate without silently skipping tests.

- [ ] **Step 1: Add or update failing cutover policy assertions**

  Run `node --test fe/scripts/check-cutover.test.mjs` and preserve the expected failure against each remaining compatibility path.

- [ ] **Step 2: Replace unresolved icon and compatibility imports**

  Use the existing Lucide icon set, shared UI exports, and feature public indexes. Do not use type suppressions or duplicate component implementations.

- [ ] **Step 3: Remove only zero-consumer compatibility files**

  Prove zero imports with `rg` before each deletion, then update routes and package dependencies.

- [ ] **Step 4: Run compiler and policy gates**

  Run `pnpm run typecheck`, `pnpm run lint:type-safety`, `pnpm run lint:boundaries`, and `node --test scripts/check-cutover.test.mjs` from `fe`; all must exit 0.

- [ ] **Step 5: Commit the cutover slice**

  Stage exact reviewed source paths and commit with `chore(fe): complete commerce generation cutover`.

### Task 3: Make E2E Acceptance Deterministic And Fully Enforced

**Files:**
- Create: `fe/e2e/modernization/_credentials.ts`
- Modify: every E2E file reported by `pnpm run lint:e2e-credentials`
- Create: `fe/scripts/assert-playwright-results.mjs`
- Create: `fe/scripts/assert-playwright-results.test.mjs`
- Create: `fe/scripts/check-e2e-credentials.mjs`
- Create: `fe/scripts/check-e2e-credentials.test.mjs`
- Create: `fe/scripts/check-release-workflows.test.mjs`
- Modify: `fe/package.json`
- Modify: `fe/playwright.config.ts`

**Interfaces:**
- `credentialForPersona` and `loginAsPersona` are the only E2E credential access points.
- `assert-playwright-results.mjs` rejects malformed reports, selected skips, failures, and missing required personas.
- Modernization journeys cover buyer, seller, admin, and cross-persona continuity with deterministic request-count assertions.

- [ ] **Step 1: Add failing credential-policy cases**

  Run `pnpm run lint:e2e-credentials` and `node --test scripts/check-e2e-credentials.test.mjs` from `fe` and capture the expected hard-coded-persona failures.

- [ ] **Step 2: Migrate all E2E login data**

  Replace seeded username/password literals with the typed credential store without changing route coverage or test semantics.

- [ ] **Step 3: Verify the result policy**

  Run `pnpm run lint:e2e-credentials`, `pnpm run typecheck:e2e`, and the focused script tests; require zero failures.

- [ ] **Step 4: Run deterministic modernization journeys**

  Start required local services, run `pnpm run test:e2e:modernization` with JSON output, then run `pnpm run test:e2e:assert-results <report>` and require zero selected skips.

- [ ] **Step 5: Commit the acceptance slice**

  Stage exact E2E and script paths and commit with `test(fe): enforce modernization acceptance journeys`.

### Task 4: Record Local Release Evidence And Candidate Commit

**Files:**
- Modify: `fe/performance/current/route-bundles.json`
- Modify: `fe/performance/current/lighthouse-mobile.json`
- Create: `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-visual-review.md`
- Create: `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-integrated.md`
- Modify: `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-performance.md`
- Modify: `docs/superpowers/plans/2026-07-29-web-commerce-modernization-master.md`

**Interfaces:**
- Visual evidence lists every declared route and viewport with outcome and finding resolution.
- Performance evidence records baseline/current gzip bytes, all three Lighthouse runs, medians, and the exact source commit.
- Integrated evidence records the commands, exit codes, image provenance, residual external gates, and reviewed source commit.

- [ ] **Step 1: Run the full local verification matrix**

  Run `pnpm run verify`, `pnpm run lint:e2e-credentials`, `pnpm run verify:e2e`, `pnpm run test:e2e:local-complete`, `pnpm run test:a11y`, `pnpm run test:visual`, `pnpm run test:states`, `pnpm run test:text-scale`, `pnpm run measure:performance`, and `pnpm run verify:performance` as environment prerequisites allow.

- [ ] **Step 2: Build and verify the exact candidate image**

  Build from the committed source tree, run `fe/scripts/run-cutover-gate.ps1` with the image reference and exact source commit, and record any unavailable Docker or browser prerequisite explicitly.

- [ ] **Step 3: Self-review the complete diff**

  Run `git diff --check`, inspect `git diff --stat`, inspect every staged name and status, and confirm no unrelated dirty path is included.

- [ ] **Step 4: Commit evidence and update status**

  Stage only evidence and plan files, commit with `docs: record commerce modernization local release evidence`, and update the master plan to distinguish shipped local work from external promotion pending.

- [ ] **Step 5: Final verification**

  Repeat the exact required gates against the final commit and report fresh exit codes. Do not claim complete if any required local gate remains red.

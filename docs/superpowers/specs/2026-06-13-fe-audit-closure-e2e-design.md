# VNShop FE Audit Closure + E2E Coverage — Design

**Date:** 2026-06-13
**Branch:** `fix/audit-closure-e2e`
**Goal:** Close the 111-item UI/UX audit on the FE, harden domain correctness, add explicit a11y E2E coverage, and run a fresh full journey + existing-workday regression — all reproducible in Docker.

---

## Scope

1. Re-verify the **111-item UI/UX audit spec** (`docs/superpowers/specs/2026-05-31-ui-ux-audit-fixes-design.md`) against `main` to find what is open, what silently regressed, and what was already covered.
2. Fix the **11 remaining items** per `SESSION-HANDOVER-2026-06-05-UIUX.md` (2 critical, 4 UX medium, 3 a11y minor — 3 a11y items must be re-discovered from the spec).
3. **Full domain audit** against the actual canonical enums in `fe/src/app/lib/domain-enums.ts` and `fe/src/app/lib/domain-constants.ts`, with Vitest guard tests.
4. **3 new Playwright journey specs** (buyer, seller, admin) from scratch + **run the existing `workday-*` + `buyer-happy-path` specs** as part of the regression gate.
5. **Dockerize the verify environment** so `npm run verify` and `npm run test:e2e` are reproducible from a clean state. Volatile data is acceptable — `docker compose down -v` between phases is the reset.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│ HOST (Windows) │
│ fe/ ◄──── bind mount, read-write, into both containers │
│ .claude/worktrees/<branch>/<task>/ ◄──── sub-agent worktree │
└────────────────────────────────────────────────────────────┘
 │
 ▼
┌────────────────────────────────────────────────────────────┐
│ Docker: fe-verify (Node 22) │
│ - tsc --noEmit, eslint, prettier --check │
│ - vitest run (unit + domain audit) │
│ - vite build │
│ Volatile volumes: node_modules, dist, .vite, vitest cache │
│ ENTRYPOINT: npm run verify │
└────────────────────────────────────────────────────────────┘
 │
 ▼
┌────────────────────────────────────────────────────────────┐
│ Docker: fe-e2e (Playwright base, profiles: [e2e]) │
│ - axe-core a11y spec for the 11 items │
│ - 3 new journey specs (buyer, seller, admin)  │
│ - existing workday-* + buyer-happy-path specs (regression) │
│ Volatile: test-results, playwright-report, ms-playwright │
│ Network: attached to vnshop stack network OR host gateway │
└────────────────────────────────────────────────────────────┘
```

**Two scripts:**
- `fe/scripts/verify.sh` → `docker compose -f fe/docker-compose.verify.yml run --rm fe-verify`
- `fe/scripts/e2e.sh` → `docker compose -f fe/docker-compose.verify.yml --profile e2e run --rm fe-e2e`

---

## Canonical domain values (the real ones)

From `fe/src/app/lib/domain-enums.ts` and `domain-constants.ts`:

| Domain | Type / constant | Source of truth |
|---|---|---|
| Order status UI | `OrderStatusUi` = `pending \| confirmed \| shipping \| delivered \| cancelled \| returned` | `parseOrderStatus()` |
| Return status UI | `ReturnStatusUi` = `pending \| approved \| rejected \| completed \| escalated` | `parseReturnStatus()` |
| Payout status UI | `PayoutStatusUi` = `pending \| completed \| failed` | `parsePayoutStatus()` |
| Payment method | `PaymentMethod` = `COD \| VNPAY \| MOMO \| BANK \| VIETQR \| STRIPE \| PAYPAL` | `PAYMENT_METHODS` const |
| Coupon type | `CouponType` = `PERCENT \| FIXED` | `COUPON_TYPES` const |
| Notification kind | `NotificationKind` = `KNOWN_NOTIFICATION_KINDS \| "GENERIC"` | `parseNotificationKind()` |
| Free-shipping threshold | `FREE_SHIPPING_THRESHOLD = 500_000` | `domain-constants.ts` |
| Flat shipping fee | `FLAT_SHIPPING_FEE = 30_000` | `domain-constants.ts` |
| Tracking steps fallback | `TRACKING_STEPS_FALLBACK` (intentional Vietnamese fallback) | `domain-constants.ts` — **whitelist** in audit |
| Currency formatting | `formatPrice()` in `fe/src/app/lib/format.ts` | Single source — no scattered `Intl.NumberFormat` |

**Roles** (not in `domain-enums.ts`): come from Keycloak `realm_access.roles` claim. Allowed values: `BUYER`, `SELLER`, `ADMIN`. Canonical location: `fe/src/app/lib/auth/` (to be confirmed by sub-agent).

---

## Phases

### Phase 0: Re-verification of the 111-item spec (new)

**Single sub-agent task.** Goal: produce a status matrix that becomes the source of truth for the rest of the work.

**Sub-agent reads:**
- `docs/superpowers/specs/2026-05-31-ui-ux-audit-fixes-design.md` (all 111 items)
- `docs/SESSION-HANDOVER-2026-06-05-UIUX.md` (what was fixed, what remains)
- `fe/src/` (current state)

**Sub-agent produces:** `docs/superpowers/specs/2026-06-13-audit-111-status-matrix.md` with one row per spec item:

| Spec ID | Category | Severity | Item | Status | Evidence |
|---|---|---|---|---|---|
| Critical #9 | Critical | High | HomePage category hardcoded IDs | OPEN | `fe/src/app/pages/HomePage.tsx:736` |
| Critical #1 | Critical | High | Payment failure falls through to success | FIXED | Commit `4594ea36` (verified) |
| ... | ... | ... | ... | ... | ... |

**Status values:** `FIXED` / `OPEN` / `PARTIAL` / `REGRESSED` (was fixed, now broken) / `OBSOLETE` (spec no longer applies).

**Output also includes:** an `OPEN_ITEMS.md` summary (the actionable list for Phase 1) and a `REGRESSED_ITEMS.md` summary (items that need re-fixing). All three files committed to the branch.

### Phase 1: Docker scaffolding + fix the 11 remaining items

**Sub-phase 1a: Docker scaffolding (1 sub-agent task)**

New files:
- `fe/Dockerfile.verify` — Node 22, `npm ci`, copies `fe/`, `ENTRYPOINT ["npm", "run", "verify"]`.
- `fe/Dockerfile.e2e` — `mcr.microsoft.com/playwright:v1.60-jammy` base + `npm ci` + `npx playwright install --with-deps chromium`. `ENTRYPOINT ["npm", "run", "test:e2e"]`.
- `fe/docker-compose.verify.yml` — two services: `fe-verify` (always) and `fe-e2e` (with `profiles: ["e2e"]`). Both bind-mount `fe/`. `fe-e2e` attaches to network `vnshop_default` (or whichever the stack uses; sub-agent inspects `docker-compose.yml` at repo root to confirm) and exposes `E2E_BASE_URL=http://frontend:3000` plus gateway env.
- `fe/.dockerignore` — excludes `node_modules`, `dist`, `playwright-report`, `test-results`, `.git`, `e2e/evidence/`.
- `fe/scripts/verify.sh`, `fe/scripts/e2e.sh` — wrappers.

**Sub-agent must verify** by running `fe-verify` against `npm run verify` on the current `main` and confirming it exits 0. If it doesn't, that's a pre-existing failure to surface, not part of this plan.

**Sub-phase 1b: 11 remaining items (1 sub-agent task per item, TDD)**

Per the handover + Phase 0 matrix. Sub-agent reads Phase 0's `OPEN_ITEMS.md` first.

| # | Spec item | File (corrected) | Test file | Action |
|---|---|---|---|---|
| 1 | Critical #9 — HomePage category hardcoded IDs | `fe/src/app/pages/HomePage.tsx` | `fe/src/app/pages/HomePage.test.tsx` (new) | Fetch categories from API, match by slug |
| 2 | Critical #16 — OrdersPage Suspense boundary | `fe/src/app/pages/OrdersPage.tsx` | `fe/src/app/pages/OrdersPage.test.tsx` (new) | Wrap `useSuspenseQuery` in `<Suspense>` + `<ErrorBoundary>` |
| 3 | UX Med #14 — Login toast action button | `fe/src/app/components/ui/` (new file) | `fe/src/app/components/ui/toast-actions.test.tsx` (new) | Login toast with "Log in" action button |
| 4 | UX Med #15 — Flash sale scroll indicators | `fe/src/app/pages/HomePage.tsx` (or `flash-sale` component if separate) | new or extend existing | Left/right arrows + dot indicators. **Sub-agent must read `fe/e2e/flash-sale-ui.spec.ts` first** to avoid duplication |
| 5 | UX Med #17 — Default payment = last-used | `fe/src/app/pages/checkout/CheckoutPage.tsx` | `fe/src/app/pages/checkout/CheckoutPage.test.tsx` (new) | localStorage `vnshop_last_payment_method`, fall back to COD. **Read `fe/e2e/payment-multi-method.spec.ts` first** |
| 6 | UX Med #18 — Admin/seller links by role | `fe/src/app/components/navbar.tsx` (NOT `Header.tsx`) | `fe/src/app/components/navbar.test.tsx` (new) | Conditionally render `nav.admin` / `nav.sellerChannel` based on user role. **Read `fe/e2e/role-routes.spec.ts` first** |
| 7-9 | 3 a11y minor items | TBD per Phase 0 re-discovery | TBD | Sub-agent reads spec, identifies which 3 from the 38 WCAG items, fixes them with aria-labels / focus / contrast |

**TDD per item:**
1. Sub-agent writes the failing test.
2. Sub-agent runs `fe-verify` filtered to that test, confirms FAIL.
3. Sub-agent implements minimal fix.
4. Sub-agent re-runs the test, confirms PASS.
5. Sub-agent runs the full `npm run verify`, confirms green.
6. Sub-agent commits with message `[spec-9] fix(fe): HomePage fetches categories from API` (or similar).
7. Verifier sub-agent checks the diff + re-runs `npm run verify` on the merge.

**Worktree strategy:** one worktree per item (parallel-safe — different files, minimal conflict). Worktrees mount via Docker bind mount automatically.

**OneDrive gotcha (per memory):** sub-agents check `Mode -a---l` on the worktree path. If a reparse-point stub appears, run the standard hydrate (copy → delete → rename) before continuing.

### Phase 2: Full domain audit

**Single sub-agent task** (read-mostly, then 1-3 fix tasks based on findings).

**Sub-agent scans every file under `fe/src/app/`** for:
1. **Order status strings** — any literal `"cancelled"`, `"delivered"`, etc. that aren't routed through `parseOrderStatus()` or imported from the enum. Must use the union type.
2. **Return status** — same for `parseReturnStatus()`.
3. **Payout status** — same for `parsePayoutStatus()`.
4. **Payment method** — any literal `"VNPAY"`, `"COD"`, etc. that aren't from `PAYMENT_METHODS` const or `isPaymentMethod()` guard.
5. **Coupon type** — `"PERCENT"` / `"FIXED"` must come from `COUPON_TYPES`.
6. **Notification kind** — must be in `KNOWN_NOTIFICATION_KINDS` or `"GENERIC"`.
7. **Threshold / fee** — `500_000`, `30_000` must reference `FREE_SHIPPING_THRESHOLD` / `FLAT_SHIPPING_FEE`, not magic numbers.
8. **Currency formatting** — `Intl.NumberFormat` outside of `format.ts` is a violation.
9. **i18n** — user-facing strings must use `t()`. Hardcoded Vietnamese or English in JSX is a violation. **Whitelist:** `TRACKING_STEPS_FALLBACK` (intentional fallback per code comment), error message constants in dedicated files.

**Output:** `docs/superpowers/specs/2026-06-13-domain-audit-report.md` with mismatch list. Each mismatch becomes a sub-task (write failing test → fix → commit).

**New test file:** `fe/src/app/lib/__tests__/domain-usage.test.ts` — Vitest static analysis test that imports the project module graph and asserts (via AST or string scan) that the canonical enum/const names are the only ones used for those slots. Acts as a guard against future drift.

### Phase 3: E2E

**Sub-phase 3a: 3 new journey specs (3 sub-agent tasks, parallel-safe)**

Each spec is **self-contained, order-independent, resets state via `globalSetup`**.

- `fe/e2e/audit-closure/buyer-journey.spec.ts` — guest browse → register → search → product → add to cart → checkout (last-used payment) → order → order detail.
- `fe/e2e/audit-closure/seller-journey.spec.ts` — seller login → list product → see order → confirm.
- `fe/e2e/audit-closure/admin-journey.spec.ts` — admin login → approve seller → moderate product → view dashboard.

**Sub-phase 3b: A11y E2E spec for the 11 items (1 sub-agent task)**

`fe/e2e/audit-closure/a11y-11-items.spec.ts`:
- `@axe-core/playwright` audit per touched page (HomePage, OrdersPage, checkout, navbar, flash-sale).
- Targeted assertions for each item: login toast has action button, category tabs fetch from API, admin/seller links hidden for buyer, etc.

**Sub-phase 3c: Playwright config + reset helper (1 sub-agent task)**

- `fe/playwright.config.ts` — adds the new spec paths, sets `globalSetup` to `fe/e2e/_helpers/reset-db.ts`.
- `fe/e2e/_helpers/reset-db.ts` — calls configuration-service `POST /api/config/reload` + a new `POST /api/test/reset` endpoint (sub-agent must add this endpoint to `configuration-service` if it doesn't exist, gated by `NODE_ENV=test`). Resets the volatile DB rows.
- Volatile DB schema is in `infra/timescaledb/init.sql` + each service's Flyway migrations — re-applied cleanly on `docker compose down -v`.

**Sub-phase 3d: Run the new specs + existing workday specs together**

Modify `fe/scripts/e2e.sh` to run BOTH:
- `fe/e2e/audit-closure/*.spec.ts` (new)
- `fe/e2e/workday-*.spec.ts` (existing)
- `fe/e2e/buyer-happy-path.spec.ts` (existing)

All must pass for Phase 3 to close.

### Phase 4: Final verification + audit-closure report

**Sub-agent runs the full gate:**
1. `fe/scripts/verify.sh` (typecheck + lint + format + vitest + build) — must be green.
2. `fe/scripts/e2e.sh` (3 new journeys + a11y + existing workday-* + buyer-happy-path) — must be green.
3. Cross-check with Phase 0 matrix: every `OPEN` item is now `FIXED` (or `DEFERRED` with documented rationale).
4. Cross-check with Phase 2 audit: every mismatch is fixed.

**Sub-agent produces:** `docs/superpowers/specs/2026-06-13-fe-audit-closure-report.md`:
- Coverage matrix (all 111 items: ✅ / ⚠️ / ❌ / DEFERRED).
- Domain audit mismatches found and fixed.
- E2E pass/fail summary.
- Build status.
- Any deferred items with rationale.

**Final commit:** branch `fix/audit-closure-e2e` → merge to `main` (or leave for user review, per preference).

---

## File structure

### New files

```
fe/
├── Dockerfile.verify [Phase 1a]
├── Dockerfile.e2e [Phase 1a]
├── docker-compose.verify.yml [Phase 1a]
├── .dockerignore [Phase 1a]
├── scripts/
│ ├── verify.sh [Phase 1a]
│ └── e2e.sh [Phase 1a]
├── src/app/pages/
│ ├── HomePage.test.tsx [Phase 1b #1, #4]
│ ├── OrdersPage.test.tsx [Phase 1b #2]
│ ├── checkout/CheckoutPage.test.tsx [Phase 1b #5]
├── src/app/components/
│ ├── ui/toast-actions.tsx [Phase 1b #3]
│ ├── ui/toast-actions.test.tsx [Phase 1b #3]
│ ├── navbar.test.tsx [Phase 1b #6]
├── src/app/lib/__tests__/
│ └── domain-usage.test.ts [Phase 2 guard]
├── e2e/audit-closure/
│ ├── buyer-journey.spec.ts  [Phase 3a]
│ ├── seller-journey.spec.ts [Phase 3a]
│ ├── admin-journey.spec.ts [Phase 3a]
│ └── a11y-11-items.spec.ts [Phase 3b]
├── e2e/_helpers/
│ └── reset-db.ts  [Phase 3c]

docs/superpowers/specs/
├── 2026-06-13-audit-111-status-matrix.md [Phase 0]
├── 2026-06-13-domain-audit-report.md [Phase 2]
├── 2026-06-13-fe-audit-closure-report.md  [Phase 4]

(services/configuration-service/src/configuration/configuration.controller.ts
 — add POST /api/test/reset endpoint, gated by NODE_ENV=test) [Phase 3c]
```

### Modified files

```
fe/
├── src/app/pages/HomePage.tsx [Phase 1b #1, #4]
├── src/app/pages/OrdersPage.tsx [Phase 1b #2]
├── src/app/pages/checkout/CheckoutPage.tsx [Phase 1b #5]
├── src/app/components/navbar.tsx [Phase 1b #6]
├── playwright.config.ts [Phase 3c]
├── scripts/e2e.sh [Phase 3d]
├── package.json (only if new deps needed)

(various files where Phase 2 finds domain mismatches) [Phase 2]
```

---

## Error handling

**Per memory: "sub-agents bail mid-task and pass off narration as completion; verify diff before trusting report."**

Every sub-agent commit:
- Verifier sub-agent checks `git diff main` is non-empty and matches the task description.
- Verifier runs `npm run verify` on the merge.
- If a sub-agent's task is taking >15 minutes, abort and re-chunk.

**Per memory: "after every sub-agent merges, do clean-code / DDD / DRY / SOLID review and fix violations."**

Each phase ends with a `code-simplifier` sub-agent pass before the verifier.

**Per memory: "OneDrive reparse-point gotcha."**

Sub-agents worktree-bootstrap script must check for `Mode -a---l` and hydrate via copy/delete/rename if needed.

**Recovery from volatile data loss:** `docker compose down -v && docker compose up -d` reseeds. No migration safety needed.

**E2E network failure:** if the e2e container can't reach the gateway, the spec run aborts with a clear error. Sub-agent's reset-db helper must include a health-check retry loop.

---

## Testing strategy

| Layer | Tool | Trigger | Container |
|---|---|---|---|
| Typecheck | `tsc -b --noEmit` | per task + per phase | fe-verify |
| Lint | `eslint .` | per task + per phase | fe-verify |
| Format | `prettier --check` | per task + per phase | fe-verify |
| Unit (Vitest) | `vitest run` | per task (TDD) + per phase | fe-verify |
| Build | `vite build` | per phase end | fe-verify |
| E2E (Playwright) | new + existing specs | Phase 3 + Phase 4 | fe-e2e |
| A11y (axe) | `@axe-core/playwright` | Phase 3b | fe-e2e |

**Hard gate:** `npm run verify` must be green from a clean Docker state (`docker compose down -v && ./scripts/verify.sh`) before any phase closes.

**Hard gate:** `npm run test:e2e` must be green from a clean Docker state before Phase 3 closes.

---

## Spec compliance check

The 111-item spec at `docs/superpowers/specs/2026-05-31-ui-ux-audit-fixes-design.md` is the source of truth. Compliance is verified:

1. **Phase 0** walks every spec item against `main` and produces a status matrix. This becomes the baseline.
2. **Per task:** commit messages include `[spec-N]` tag. Test file references the spec item in a header comment.
3. **Phase 4 report** traces every spec item to a fix + test (or a documented deferral).
4. **Phase 2 domain audit** is a separate spec compliance pass for canonical-value usage.

---

## Out of scope

- Backend API changes (all FE-only, except the configuration-service test-reset endpoint, which is dev-only and gated by `NODE_ENV=test`).
- New feature implementation beyond the 11 items.
- Full WCAG certification (requires manual AT testing per spec).
- Performance optimization beyond what the audit calls for.
- Migrating to the 2026-06-06 frontend-redesign (separate spec).
- Production observability / Sentry wiring.

---

## Open questions resolved

| Question | Resolution |
|---|---|
| Re-verify all 111 items? | **Yes** — Phase 0 re-verification produces status matrix. |
| E2E journey specs? | **3 new specs from scratch** + run existing `workday-*` + `buyer-happy-path` as regression. |
| Domain check strictness? | **Full audit** of the actual canonical enums (`OrderStatusUi`, `PaymentMethod`, `CouponType`, `NotificationKind`, `FREE_SHIPPING_THRESHOLD`, `FLAT_SHIPPING_FEE`) with Vitest guard tests. |
| Docker the verify env? | **Yes** — `Dockerfile.verify` + `Dockerfile.e2e` + `docker-compose.verify.yml` with volatile volumes. |
| Volatile data OK? | **Yes** — `docker compose down -v` between phases is the reset; no migration safety needed on test DB. |

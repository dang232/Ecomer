# FE Audit Closure + E2E Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 111-item UI/UX audit on the VNShop FE, harden domain correctness, and add a11y + 3 new journey E2E specs — all reproducible in Docker, with volatile test data.

**Architecture:** Single branch `fix/audit-closure-e2e`. Five phases (0→1→2→3→4). Sub-agents work in git worktrees, one task per sub-agent, TDD per task, verifier sub-agent per phase. Docker containers (`fe-verify`, `fe-e2e`) reproduce `npm run verify` and `npm run test:e2e` from clean state.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Playwright, `@axe-core/playwright`, Docker Compose, Sonner (toasts). Existing test scripts: `npm run verify` (typecheck + lint + format + vitest + build) and `npm run test:e2e`.

**Branch:** `fix/audit-closure-e2e` (created from `main` at execution time).

---

## Pre-flight (run once before any task)

### Pre-0.1: Detect + hydrate OneDrive reparse-point (memory: feedback_onedrive_reparse_point_gotcha)

Sub-agents bootstrap their worktrees under `.claude/worktrees/`. On Windows + OneDrive, files can appear as `Mode -a---l` cloud stubs that break Playwright discovery.

**Step 1: Check for reparse-point**

```bash
cd "C:/Users/dangq/OneDrive/Documents/GitHub/Full-Stack-E-commerce"
git worktree add .claude/worktrees/fix-audit-closure-e2e -b fix/audit-closure-e2e main
ls -la .claude/worktrees/fix-audit-closure-e2e/fe/src/app/pages/HomePage.tsx
```

**Expected:** file present and readable. If output shows `Mode -a---l` or `?` permissions, it's a cloud stub.

**Step 2: If stubbed, hydrate**

```bash
cp .claude/worktrees/fix-audit-closure-e2e/fe/src/app/pages/HomePage.tsx /tmp/HomePage.tsx
rm .claude/worktrees/fix-audit-closure-e2e/fe/src/app/pages/HomePage.tsx
mv /tmp/HomePage.tsx .claude/worktrees/fix-audit-closure-e2e/fe/src/app/pages/HomePage.tsx
```

Re-check `ls -la`. If still stubbed, repeat for all files the task touches.

**Step 3: Smoke test the worktree**

```bash
cd .claude/worktrees/fix-audit-closure-e2e
npm --prefix fe install --no-audit --no-fund
npm --prefix fe run typecheck
```

**Expected:** typecheck exits 0. If it fails, the worktree is broken — pick a different worktree root or hydrate more files.

---

## Phase 0: Re-verify the 111-item spec against `main`

**One sub-agent task.** Produces the source-of-truth matrix that all later phases consume.

### Task 0.1: Produce audit status matrix

**Files:**
- Create: `docs/superpowers/specs/2026-06-13-audit-111-status-matrix.md`
- Create: `docs/superpowers/specs/2026-06-13-OPEN_ITEMS.md`
- Create: `docs/superpowers/specs/2026-06-13-REGRESSED_ITEMS.md`
- Read: `docs/superpowers/specs/2026-05-31-ui-ux-audit-fixes-design.md` (all 111 items)
- Read: `docs/SESSION-HANDOVER-2026-06-05-UIUX.md` (the 11 remaining items per handover)

- [ ] **Step 1: Read the spec + handover in full**

```bash
cat docs/superpowers/specs/2026-05-31-ui-ux-audit-fixes-design.md | wc -l
cat docs/SESSION-HANDOVER-2026-06-05-UIUX.md
```

- [ ] **Step 2: For each of the 111 spec items, classify the current state on `main`**

Classify as one of:
- `FIXED` — code shows the fix is in place.
- `OPEN` — fix not present; needs Phase 1 work.
- `PARTIAL` — partially fixed; needs more work.
- `REGRESSED` — was fixed, but no longer present on `main`.
- `OBSOLETE` — spec no longer applies (e.g., component removed).

For each, gather evidence: file path:line, commit SHA, or "no evidence found".

- [ ] **Step 3: Write the status matrix**

Create `docs/superpowers/specs/2026-06-13-audit-111-status-matrix.md` with one row per spec item:

```markdown
# 111-Item UI/UX Audit Status Matrix

Generated: 2026-06-13
Spec: docs/superpowers/specs/2026-05-31-ui-ux-audit-fixes-design.md

| Spec ID | Category | Severity | Item | Status | Evidence |
|---|---|---|---|---|---|
| Critical #1 | Critical | High | Payment failure falls through to success | FIXED | commit 4594ea36, fe/src/app/pages/checkout/CheckoutPage.tsx:300 |
| ... |
```

- [ ] **Step 4: Extract open items**

Create `docs/superpowers/specs/2026-06-13-OPEN_ITEMS.md` with just the `OPEN` and `PARTIAL` rows from the matrix — these are the actionable list for Phase 1.

- [ ] **Step 5: Extract regressed items**

Create `docs/superpowers/specs/2026-06-13-REGRESSED_ITEMS.md` with just the `REGRESSED` rows.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-06-13-audit-111-status-matrix.md
git add docs/superpowers/specs/2026-06-13-OPEN_ITEMS.md
git add docs/superpowers/specs/2026-06-13-REGRESSED_ITEMS.md
git commit -m "docs(audit): Phase 0 — 111-item status matrix against main"
```

**Verifier sub-agent:** read each row's evidence claim, spot-check 5 random rows against the actual code, confirm classification. Reject if any spot-check fails.

---

## Phase 1: Docker scaffolding + fix the remaining items

Phase 1a (Docker scaffolding) is a single sub-agent. Phase 1b (item fixes) is templated: for each `OPEN`/`REGRESSED` row in `OPEN_ITEMS.md`, one sub-agent task. The first 1-2 are spelled out below; later ones are templated.

### Phase 1a: Docker verify environment

#### Task 1.1: Create Dockerfile.verify

**Files:**
- Create: `fe/Dockerfile.verify`

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# Dockerfile.verify — runs `npm run verify` (typecheck + lint + format + vitest + build)
# Used by fe-verify service in docker-compose.verify.yml.
FROM node:22-bookworm-slim

WORKDIR /app

# Install deps first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Source is bind-mounted at /app, but copy package files at build time so
# the bind mount can override source without losing node_modules.
COPY tsconfig*.json vite.config.ts vitest.config.ts eslint.config.js ./
COPY public ./public
COPY index.html ./
COPY src ./src
COPY e2e ./e2e

# Volatile: dist, .vite, vitest cache go into /tmp volumes at runtime.
ENV NODE_ENV=development \
 NPM_CONFIG_UPDATE_NOTIFIER=false

ENTRYPOINT ["npm", "run", "verify"]
```

- [ ] **Step 2: Smoke-test the build**

```bash
cd fe
docker build -f Dockerfile.verify -t vnshop-fe-verify:test .
```

**Expected:** build completes; image created.

- [ ] **Step 3: Commit**

```bash
git add fe/Dockerfile.verify
git commit -m "chore(fe): add Dockerfile.verify for reproducible verify"
```

#### Task 1.2: Create docker-compose.verify.yml

**Files:**
- Create: `fe/docker-compose.verify.yml`
- Create: `fe/.dockerignore`

- [ ] **Step 1: Write .dockerignore**

```
node_modules
dist
.vite
playwright-report
test-results
e2e/evidence
.git
coverage
*.tsbuildinfo
.env
.env.*
```

- [ ] **Step 2: Write docker-compose.verify.yml**

```yaml
# docker-compose.verify.yml
# Reproducible verify + e2e for the VNShop frontend.
# Volatile data is OK — `docker compose down -v` between runs is the reset.
name: vnshop-fe-verify

services:
 fe-verify:
 build:
  context: .
 dockerfile: Dockerfile.verify
 working_dir: /app
 volumes:
 - .:/app
 - verify_node_modules:/app/node_modules
 - verify_vite_cache:/app/.vite
 environment:
 - CI=true
 command: ["npm", "run", "verify"]

 fe-e2e:
 profiles: ["e2e"] # only run with --profile e2e
 build:
 context: .
 dockerfile: Dockerfile.e2e
 working_dir: /app
 volumes:
 - .:/app
 - e2e_node_modules:/app/node_modules
 - e2e_ms_playwright:/ms-playwright
 - e2e_test_results:/app/test-results
 - e2e_report:/app/playwright-report
 environment:
 - VITE_E2E_BASE_URL=http://frontend:3000
 - CI=true
 network_mode: host # so the e2e container can reach localhost:3000 (the running FE)
 command: ["npm", "run", "test:e2e"]

volumes:
 verify_node_modules:
 verify_vite_cache:
 e2e_node_modules:
 e2e_ms_playwright:
 e2e_test_results:
 e2e_report:
```

- [ ] **Step 3: Commit**

```bash
git add fe/.dockerignore fe/docker-compose.verify.yml
git commit -m "chore(fe): add docker-compose.verify.yml for fe-verify and fe-e2e"
```

#### Task 1.3: Create Dockerfile.e2e

**Files:**
- Create: `fe/Dockerfile.e2e`

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# Dockerfile.e2e — runs Playwright E2E suite.
FROM mcr.microsoft.com/playwright:v1.60-jammy

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig*.json vite.config.ts vitest.config.ts playwright.config.ts eslint.config.js ./
COPY public ./public
COPY index.html ./
COPY src ./src
COPY e2e ./e2e
COPY scripts ./scripts

ENV NODE_ENV=test \
 CI=true \
 NPM_CONFIG_UPDATE_NOTIFIER=false

ENTRYPOINT ["npm", "run", "test:e2e"]
```

- [ ] **Step 2: Smoke-test the build**

```bash
cd fe
docker build -f Dockerfile.e2e -t vnshop-fe-e2e:test .
```

**Expected:** build completes.

- [ ] **Step 3: Commit**

```bash
git add fe/Dockerfile.e2e
git commit -m "chore(fe): add Dockerfile.e2e for Playwright"
```

#### Task 1.4: Add verify.sh + e2e.sh wrappers

**Files:**
- Create: `fe/scripts/verify.sh`
- Create: `fe/scripts/e2e.sh`

- [ ] **Step 1: Write fe/scripts/verify.sh**

```bash
#!/usr/bin/env bash
# fe/scripts/verify.sh — run `npm run verify` inside Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f docker-compose.verify.yml run --rm fe-verify
```

- [ ] **Step 2: Write fe/scripts/e2e.sh**

```bash
#!/usr/bin/env bash
# fe/scripts/e2e.sh — run Playwright inside Docker with e2e profile.
set -euo pipefail
cd "$(dirname "$0")/.."
# Pre-hydrate Playwright (OneDrive reparse-point workaround for the host).
node scripts/hydrate-e2e.mjs || true
docker compose -f docker-compose.verify.yml --profile e2e run --rm fe-e2e
```

- [ ] **Step 3: Make executable and commit**

```bash
chmod +x fe/scripts/verify.sh fe/scripts/e2e.sh
git add fe/scripts/verify.sh fe/scripts/e2e.sh
git commit -m "chore(fe): add verify.sh and e2e.sh Docker wrappers"
```

#### Task 1.5: Verify the Docker scaffolding works on `main`

- [ ] **Step 1: Run fe-verify from a clean state**

```bash
cd fe
docker compose -f docker-compose.verify.yml down -v
./scripts/verify.sh
```

**Expected:** all of typecheck, lint, prettier --check, vitest, and vite build pass. The exit code is 0.

If any step fails, this is a pre-existing failure on `main` — record it in `docs/superpowers/specs/2026-06-13-fe-audit-closure-report.md` under "Pre-existing failures" and STOP this task. Do not attempt to fix pre-existing failures here.

- [ ] **Step 2: Commit the green state (if not already)**

```bash
git status # should be clean
```

No commit needed if `main` was already green.

- [ ] **Step 3: Verifier sub-agent runs the same script**

The verifier sub-agent re-runs `./scripts/verify.sh` from a clean state. Confirms green.

### Phase 1b: Fix each `OPEN` or `REGRESSED` item

**Templated per row in `OPEN_ITEMS.md`. The first one is spelled out; later ones use the same template.**

#### Task 1.6: [TEMPLATED — copy for each item in OPEN_ITEMS.md] Fix <spec ID> — <short description>

**Files (sub-agent reads `OPEN_ITEMS.md` and fills in):**
- Modify: <file from spec item, e.g., `fe/src/app/pages/OrdersPage.tsx`>
- Create: <test file, e.g., `fe/src/app/pages/OrdersPage.test.tsx`>

- [ ] **Step 1: Read the spec item**

Sub-agent reads the row in `OPEN_ITEMS.md` and the original spec section in `docs/superpowers/specs/2026-05-31-ui-ux-audit-fixes-design.md`. Notes the **exact file:line** and the **fix description**.

- [ ] **Step 2: Look for existing E2E coverage**

Before writing a new test, sub-agent greps for related Playwright specs:

```bash
grep -rln "<keyword from spec item>" fe/e2e/
```

If a spec already covers this, note it and skip the unit test (the E2E in Phase 3 is the primary coverage). Otherwise proceed to Step 3.

- [ ] **Step 3: Write the failing Vitest test (if no E2E coverage exists)**

Sub-agent writes a test in the file noted above. Test must:
- Mount the component in isolation (RTL + `happy-dom`).
- Assert the post-fix behavior.
- Use real imports (e.g., `parseOrderStatus` from `domain-enums.ts`), not mocks.
- Reference the spec item in a comment header:

```tsx
/**
 * Test for spec Critical #16: OrdersPage useSuspenseQuery needs <Suspense> boundary.
 * Spec: docs/superpowers/specs/2026-05-31-ui-ux-audit-fixes-design.md (lines ~140)
 */
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrdersPage } from "./OrdersPage";
import { MemoryRouter } from "react-router";

it("renders Suspense fallback while orders load", async () => {
 const qc = new QueryClient({ defaultOptions: { queries { retry: false } } });
 render(
 <QueryClientProvider client={qc}>
 <MemoryRouter>
 <OrdersPage />
 </MemoryRouter>
 </QueryClientProvider>
 );
 // Assert the Suspense fallback is visible during initial load.
 expect(screen.getByTestId("orders-suspense-fallback")).toBeInTheDocument();
 await waitFor(() => expect(screen.getByTestId("orders-list")).toBeInTheDocument());
});
```

(Sub-agent adapts the test to the actual item. The above is an example for spec item Critical #16.)

- [ ] **Step 4: Run the test to confirm it fails**

```bash
cd fe
docker compose -f docker-compose.verify.yml run --rm fe-verify \
 npx vitest run <path-to-test-file>
```

**Expected:** FAIL. (If it passes, the test isn't testing the right thing — fix the test.)

- [ ] **Step 5: Implement the minimal fix**

Sub-agent edits the source file per the spec item. Examples:
- Critical #9: replace hardcoded category array with `useCategories()` hook.
- Critical #16: wrap `useSuspenseQuery` consumer in `<Suspense fallback={<OrdersLoading />}>` + `<ErrorBoundary>`.
- UX Med #14: add `action` parameter to login toast.
- UX Med #15: add left/right arrow buttons + dot indicators to flash-sale carousel.
- UX Med #17: in `CheckoutPage`, read `localStorage.getItem("vnshop_last_payment_method")`; default to it; fall back to `"COD"`.
- UX Med #18: in `navbar.tsx`, gate `nav.admin` and `nav.sellerChannel` links behind `user.roles.includes("ADMIN")` / `user.roles.includes("SELLER")`.
- A11y (3 minor): sub-agent re-discovers from spec, applies the WCAG fix.

- [ ] **Step 6: Re-run the test to confirm it passes**

```bash
cd fe
docker compose -f docker-compose.verify.yml run --rm fe-verify \
 npx vitest run <path-to-test-file>
```

**Expected:** PASS.

- [ ] **Step 7: Run the full verify**

```bash
cd fe
./scripts/verify.sh
```

**Expected:** all green. If anything fails, fix it before committing.

- [ ] **Step 8: Commit with [spec-N] tag**

```bash
git add <files>
git commit -m "[spec-<id>] fix(fe): <short description>"
```

- [ ] **Step 9: Verifier sub-agent spot-checks**

The verifier sub-agent:
- Reads the diff (`git diff HEAD~1`).
- Re-runs the new test.
- Re-runs the full `./scripts/verify.sh`.
- Confirms the spec item description in `OPEN_ITEMS.md` matches the fix.

If any check fails, the verifier rejects; sub-agent fixes and re-submits.

#### Task 1.7: Update OPEN_ITEMS.md to mark items as done

After all spec items in 1.6 are committed:

- [ ] **Step 1: Move fixed rows to a "Closed" section**

Edit `docs/superpowers/specs/2026-06-13-OPEN_ITEMS.md`:
- Move the just-fixed rows to a new `## Closed (Phase 1b)` section at the bottom with the commit SHAs.
- Keep the `## Open` section with any remaining items.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-13-OPEN_ITEMS.md
git commit -m "docs(audit): mark Phase 1b items as closed in OPEN_ITEMS.md"
```

---

## Phase 2: Full domain audit

**One sub-agent task for the audit + N sub-agent tasks (one per mismatch) for fixes.**

### Task 2.1: Run the domain audit

**Files:**
- Create: `docs/superpowers/specs/2026-06-13-domain-audit-report.md`
- Read: `fe/src/app/lib/domain-enums.ts`
- Read: `fe/src/app/lib/domain-constants.ts`
- Read: `fe/src/app/lib/format.ts`

- [ ] **Step 1: Confirm canonical domain values (already in the spec)**

Re-read the enums:

| Domain | Source |
|---|---|
| `OrderStatusUi` + `parseOrderStatus()` | `fe/src/app/lib/domain-enums.ts:16-36` |
| `ReturnStatusUi` + `parseReturnStatus()` | `fe/src/app/lib/domain-enums.ts:40-49` |
| `PayoutStatusUi` + `parsePayoutStatus()` | `fe/src/app/lib/domain-enums.ts:53-60` |
| `PAYMENT_METHODS` const + `isPaymentMethod()` | `fe/src/app/lib/domain-enums.ts:65-70` |
| `COUPON_TYPES` const | `fe/src/app/lib/domain-enums.ts:74-75` |
| `KNOWN_NOTIFICATION_KINDS` + `parseNotificationKind()` | `fe/src/app/lib/domain-enums.ts:82-104` |
| `FREE_SHIPPING_THRESHOLD = 500_000` | `fe/src/app/lib/domain-constants.ts:11` |
| `FLAT_SHIPPING_FEE = 30_000` | `fe/src/app/lib/domain-constants.ts:14` |
| `TRACKING_STEPS_FALLBACK` (whitelist) | `fe/src/app/lib/domain-constants.ts:17-23` |
| `formatPrice()` (single currency formatter) | `fe/src/app/lib/format.ts:6-10` |

- [ ] **Step 2: Scan for violations**

For each domain value, grep `fe/src/` for hardcoded literals:

```bash
# Example: any literal "VNPAY" that's not from PAYMENT_METHODS
grep -rn '"VNPAY"\|'"'"'VNPAY'"'"'' fe/src/ --include="*.ts" --include="*.tsx" \
 | grep -v "domain-enums.ts" \
 | grep -v "fe/src/app/lib/api/endpoints" # API response payloads are allowed
```

Repeat for: `"MOMO"`, `"STRIPE"`, `"PAYPAL"`, `"VIETQR"`, `"BANK"`, `"COD"`, `"PERCENT"`, `"FIXED"`, `"ORDER_PLACED"`, `"ORDER_ACCEPTED"`, etc., plus order status strings (`"cancelled"`, `"delivered"`, etc.) and the magic numbers `500000`, `500_000`, `30000`, `30_000`.

Also scan for:
- `new Intl.NumberFormat` outside `format.ts` (currency formatting).
- `Intl.DateTimeFormat` outside `format.ts` (date formatting, except for tests).
- Vietnamese or English literals in JSX (i18n violations). The whitelist: `TRACKING_STEPS_FALLBACK` and any i18n key defaults (`defaultValue: "..."`).

- [ ] **Step 3: Write the audit report**

Create `docs/superpowers/specs/2026-06-13-domain-audit-report.md`:

```markdown
# Domain Audit Report

Generated: 2026-06-13
Scope: fe/src/app/

## Canonical values

(List the table from Step 1.)

## Findings

| # | Domain | File:line | Current code | Issue | Suggested fix |
|---|---|---|---|---|---|
| 1 | PaymentMethod | fe/src/app/pages/checkout/CheckoutPage.tsx:80 | `VNPAY: fallback[0]` | Hardcoded "VNPAY" string | Import `PAYMENT_METHODS` from `domain-enums.ts` |
| 2 | FREE_SHIPPING_THRESHOLD | fe/src/app/pages/CartPage.tsx:142 | `if (subtotal >= 500000)` | Magic number | Import `FREE_SHIPPING_THRESHOLD` |
| ... |
```

If no violations: write "No violations found" under Findings.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-13-domain-audit-report.md
git commit -m "docs(audit): Phase 2 — domain audit report"
```

### Task 2.2: Add the domain-usage guard test

**Files:**
- Create: `fe/src/app/lib/__tests__/domain-usage.test.ts`

- [ ] **Step 1: Write the guard test**

The test scans the FE source for forbidden literals and fails if any are found.

```ts
/**
 * Domain usage guard.
 * Scans fe/src/ for hardcoded enum/constant values that should come from
 * domain-enums.ts or domain-constants.ts. Prevents drift.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");
const ALLOWLIST_FILES = new Set([
 "src/lib/domain-enums.ts",
 "src/lib/domain-constants.ts",
 "src/lib/api/endpoints", // API response types echo the backend enums
 "src/lib/format.ts", // format.ts intentionally uses "vi-VN" + "VND"
 "src/lib/i18n", // translation files
 "src/lib/domain-constants.ts:17-23", // TRACKING_STEPS_FALLBACK whitelist
]);

function walk(dir: string, out: string[] = []): string[] {
 for (const entry of readdirSync(dir)) {
 const full = join(dir, entry);
 const st = statSync(full);
 if (st.isDirectory()) walk(full, out);
 else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
 }
 return out;
}

function isAllowlisted(file: string): boolean {
 const rel = file.replace(process.cwd().replace(/\\/g, "/") + "/", "").replace(/\\/g, "/");
 for (const allow of ALLOWLIST_FILES) {
 if (rel.startsWith(allow) || rel.includes(allow)) return true;
 }
 return false;
}

describe("domain-usage guard", () => {
 const files = walk(SRC_ROOT);

 it("has no hardcoded payment method literals", () => {
 const forbidden = ["VNPAY", "MOMO", "STRIPE", "PAYPAL", "VIETQR"];
 const violations: string[] = [];
 for (const f of files) {
 if (isAllowlisted(f)) continue;
 const text = readFileSync(f, "utf8");
 for (const lit of forbidden) {
 const re = new RegExp(`["']${lit}["']`, "g");
 if (re.test(text)) violations.push(`${f}: ${lit}`);
 }
 }
 expect(violations, `Hardcoded payment methods:\n${violations.join("\n")}`).toEqual([]);
 });

 it("has no hardcoded coupon type literals", () => {
 const forbidden = ["PERCENT", "FIXED"];
 const violations: string[] = [];
 for (const f of files) {
 if (isAllowlisted(f)) continue;
 const text = readFileSync(f, "utf8");
 for (const lit of forbidden) {
 const re = new RegExp(`["']${lit}["']`, "g");
 if (re.test(text)) violations.push(`${f}: ${lit}`);
 }
 }
 expect(violations, `Hardcoded coupon types:\n${violations.join("\n")}`).toEqual([]);
 });

 it("has no magic shipping thresholds or fees", () => {
 // 500_000 (free shipping) and 30_000 (flat fee) should reference the constants.
 const re = /\b(500_?000|30_?000)\b/g;
 const violations: string[] = [];
 for (const f of files) {
 if (isAllowlisted(f)) continue;
 const text = readFileSync(f, "utf8");
 if (re.test(text)) violations.push(f);
 }
 expect(violations, `Magic shipping numbers:\n${violations.join("\n")}`).toEqual([]);
 });

 it("has no scattered Intl.NumberFormat or Intl.DateTimeFormat", () => {
 const violations: string[] = [];
 for (const f of files) {
 if (isAllowlisted(f)) continue;
 const text = readFileSync(f, "utf8");
 if (/new\s+Intl\.(NumberFormat|DateTimeFormat)/.test(text)) violations.push(f);
 }
 expect(violations, `Direct Intl formatters (use format.ts):\n${violations.join("\n")}`).toEqual([]);
 });
});
```

- [ ] **Step 2: Run the test to confirm current state**

```bash
cd fe
docker compose -f docker-compose.verify.yml run --rm fe-verify \
 npx vitest run src/app/lib/__tests__/domain-usage.test.ts
```

**Expected:** some tests may FAIL — that's the baseline of existing violations. If all pass, the FE is already clean. If any fail, those are the items Phase 2.3 (next task) must fix.

- [ ] **Step 3: Commit the test**

```bash
git add fe/src/app/lib/__tests__/domain-usage.test.ts
git commit -m "test(fe): add domain-usage guard test (baseline)"
```

### Task 2.3: Fix each domain violation

**Templated per row in the audit report (Task 2.1).**

- [ ] **Step 1: For each row in the audit report, apply the suggested fix**

Sub-agent:
- Imports the canonical value from `domain-enums.ts` or `domain-constants.ts`.
- Replaces the hardcoded literal.
- Updates the call site if needed (e.g., `if (subtotal >= FREE_SHIPPING_THRESHOLD)`).

- [ ] **Step 2: Re-run the guard test after each fix**

```bash
cd fe
docker compose -f docker-compose.verify.yml run --rm fe-verify \
 npx vitest run src/app/lib/__tests__/domain-usage.test.ts
```

**Expected:** the corresponding assertion passes.

- [ ] **Step 3: Run full verify**

```bash
cd fe
./scripts/verify.sh
```

**Expected:** green.

- [ ] **Step 4: Commit per fix (one commit per row)**

```bash
git add <files>
git commit -m "fix(fe): use PAYMENT_METHODS[VNPAY] instead of hardcoded string"
```

- [ ] **Step 5: Verifier sub-agent**

Verifies the guard test now passes for all domains and `./scripts/verify.sh` is still green.

### Task 2.4: Update audit report to "All clean"

- [ ] **Step 1: Update the report**

Edit `docs/superpowers/specs/2026-06-13-domain-audit-report.md` — change Findings to "All violations fixed. Guard test green."

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-13-domain-audit-report.md
git commit -m "docs(audit): mark Phase 2 domain audit as resolved"
```

---

## Phase 3: E2E

**Sub-phase 3a: 3 new journey specs (3 sub-agents, parallel-safe on different files).**
**Sub-phase 3b: A11y spec (1 sub-agent).**
**Sub-phase 3c: Playwright config + reset helper (1 sub-agent).**
**Sub-phase 3d: Run all together + verify (1 sub-agent).**

### Task 3.1: Add test-reset endpoint to configuration-service

**Files:**
- Modify: `services/configuration-service/src/configuration/configuration.controller.ts`
- Modify: `services/configuration-service/src/configuration/configuration.service.ts` (if helper needed)

- [ ] **Step 1: Read the existing controller**

```bash
cat services/configuration-service/src/configuration/configuration.controller.ts
```

- [ ] **Step 2: Add the reset endpoint (gated by NODE_ENV=test)**

```ts
@Post("test/reset")
resetTestData() {
 if (process.env.NODE_ENV !== "test") {
 throw new HttpException("Endpoint disabled outside test mode", 403);
 }
 // Truncate volatile test rows + reseed baseline.
 // Concrete implementation depends on the service's responsibilities.
 // Minimal contract: returns { ok: true, seeded: ["3 sellers", "5 buyers", "20 products"] }.
 return this.configService.resetTestData();
}
```

(Sub-agent adjusts the controller route + service method to match existing patterns.)

- [ ] **Step 3: Commit**

```bash
git add services/configuration-service/src/configuration/configuration.controller.ts
git commit -m "feat(config): add test-reset endpoint (NODE_ENV=test only)"
```

### Task 3.2: Create reset-db helper

**Files:**
- Create: `fe/e2e/_helpers/reset-db.ts`

- [ ] **Step 1: Write the helper**

```ts
/**
 * e2e/_helpers/reset-db.ts
 * Playwright globalSetup: reset the volatile test DB via configuration-service.
 */
import { request, type FullConfig } from "@playwright/test";

const RESET_URL = process.env.E2E_RESET_URL ?? "http://localhost:8097/api/config/test/reset";
const RESET_TOKEN = process.env.E2E_RESET_TOKEN ?? "dev-reset-token";

export default async function globalSetup(_config: FullConfig) {
 const ctx = await request.newContext({
 baseURL: RESET_URL,
 extraHTTPHeaders: { "x-reset-token": RESET_TOKEN },
 });
 const res = await ctx.post("");
 if (!res.ok()) {
 throw new Error(
 `reset-db failed: ${res.status()} ${res.statusText()} — body: ${await res.text()}`,
 );
 }
 console.log("reset-db: OK");
 await ctx.dispose();
}
```

- [ ] **Step 2: Commit**

```bash
git add fe/e2e/_helpers/reset-db.ts
git commit -m "test(fe): add Playwright globalSetup reset-db helper"
```

### Task 3.3: Update playwright.config.ts to wire reset-db + new spec paths

**Files:**
- Modify: `fe/playwright.config.ts`

- [ ] **Step 1: Read current config**

```bash
cat fe/playwright.config.ts
```

- [ ] **Step 2: Add globalSetup and testMatch entries**

Edit `fe/playwright.config.ts` (add only the new lines, keep existing):

```ts
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.VITE_E2E_BASE_URL ?? "http://localhost:3000";
const skipWebServer =
 process.env.E2E_SKIP_WEBSERVER !== undefined || baseURL.includes(":3000");

export default defineConfig({
 testDir: "./e2e",
 testMatch: [
 // New audit-closure specs:
 "audit-closure/buyer-journey.spec.ts",
 "audit-closure/seller-journey.spec.ts",
 "audit-closure/admin-journey.spec.ts",
 "audit-closure/a11y-11-items.spec.ts",
 // Existing regression specs:
 "workday-buyer.spec.ts",
 "workday-seller.spec.ts",
 "workday-admin.spec.ts",
 "buyer-happy-path.spec.ts",
 // Any other existing spec the suite already runs.
 "**/*.spec.ts",
 ],
 globalSetup: "./e2e/_helpers/reset-db.ts",
 timeout: 60_000,
 expect: { timeout: 10_000 },
 fullyParallel: false,
 workers: 1,
 retries: process.env.CI ? 1 : 0,
 reporter: [["list"], ["html", { open: "never" }]],
 use: {
 baseURL,
 trace: "retain-on-failure",
 screenshot: "only-on-failure",
 video: "retain-on-failure",
 },
 projects: [
 { name: "chromium", use: { ...devices["Desktop Chrome"] } },
 ],
 webServer: skipWebServer
 ? undefined
 : { command: "npm run dev", url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
```

- [ ] **Step 3: Commit**

```bash
git add fe/playwright.config.ts
git commit -m "test(fe): wire reset-db globalSetup and audit-closure spec paths"
```

### Task 3.4: Buyer journey spec

**Files:**
- Create: `fe/e2e/audit-closure/buyer-journey.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
/**
 * Buyer journey: register → search → product → add to cart → checkout → order.
 * Spec: docs/superpowers/specs/2026-06-13-fe-audit-closure-e2e-design.md (Phase 3a)
 */
import { test, expect } from "@playwright/test";

const BUYER_EMAIL = `buyer-${Date.now()}@vnshop.test`;
const BUYER_PASS = "TestPass123!";

test.describe("buyer journey", () => {
 test("register → search → add to cart → checkout (last-used payment) → order", async ({ page }) => {
 // 1. Register
 await page.goto("/register");
 await page.getByLabel("Email").fill(BUYER_EMAIL);
 await page.getByLabel("Password").fill(BUYER_PASS);
 await page.getByLabel("Full name").fill("Test Buyer");
 await page.getByRole("button", { name: "Register" }).click();
 await expect(page).toHaveURL(/\/($|home|search)/);

 // 2. Search
 await page.getByPlaceholder("Search products...").fill("phone");
 await page.keyboard.press("Enter");
 await expect(page).toHaveURL(/\/search/);

 // 3. Open first product
 await page.getByTestId("product-card").first().click();
 await expect(page).toHaveURL(/\/products\//);

 // 4. Add to cart
 await page.getByRole("button", { name: "Add to cart" }).click();
 await expect(page.getByTestId("cart-count")).toHaveText(/[1-9]/);

 // 5. Checkout
 await page.goto("/cart");
 await page.getByRole("button", { name: "Checkout" }).click();
 await expect(page).toHaveURL(/\/checkout/);

 // 6. Default payment should default to COD (no last-used yet)
 await expect(page.getByTestId("payment-method-COD")).toBeChecked();

 // 7. Select a different method, then complete
 await page.getByTestId("payment-method-BANK").check();
 await page.getByRole("button", { name: "Place order" }).click();
 await expect(page).toHaveURL(/\/orders\/[a-f0-9-]+/);

 // 8. Verify order appears in orders list
 await page.goto("/orders");
 await expect(page.getByText("BANK")).toBeVisible();
 });
});
```

- [ ] **Step 2: Run the spec**

```bash
cd fe
docker compose -f docker-compose.verify.yml down -v
docker compose -f docker-compose.verify.yml up -d # bring the FE service
./scripts/e2e.sh -- audit-closure/buyer-journey
```

(Or, if running outside Docker for iteration: `npx playwright test e2e/audit-closure/buyer-journey.spec.ts`.)

**Expected:** PASS within 60s. If fails, fix and re-run.

- [ ] **Step 3: Commit**

```bash
git add fe/e2e/audit-closure/buyer-journey.spec.ts
git commit -m "test(fe): add buyer journey E2E spec"
```

### Task 3.5: Seller journey spec

**Files:**
- Create: `fe/e2e/audit-closure/seller-journey.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
/**
 * Seller journey: login → list product → see order → confirm.
 * Requires that reset-db seeded at least one SELLER user.
 */
import { test, expect } from "@playwright/test";

const SELLER_EMAIL = "seller1@vnshop.test"; // seeded by reset-db
const SELLER_PASS = "TestPass123!";

test.describe("seller journey", () => {
 test("login → list product → confirm incoming order", async ({ page }) => {
 await page.goto("/login");
 await page.getByLabel("Email").fill(SELLER_EMAIL);
 await page.getByLabel("Password").fill(SELLER_PASS);
 await page.getByRole("button", { name: "Log in" }).click();
 await expect(page).toHaveURL(/\/($|home|search)/);

 // Seller hub link is visible (spec UX Med #18)
 await expect(page.getByRole("link", { name: /seller hub/i })).toBeVisible();

 await page.getByRole("link", { name: /seller hub/i }).click();
 await expect(page).toHaveURL(/\/seller/);

 // List a product
 await page.getByRole("button", { name: /add product|list product/i }).click();
 await page.getByLabel("Title").fill("Test Product " + Date.now());
 await page.getByLabel("Price").fill("100000");
 await page.getByLabel("Stock").fill("10");
 await page.getByRole("button", { name: /save|create/i }).click();
 await expect(page.getByText("Test Product")).toBeVisible();

 // Confirm an order (assumes one was seeded)
 await page.getByRole("link", { name: /orders/i }).click();
 await page.getByRole("button", { name: /accept|confirm/i }).first().click();
 await expect(page.getByText(/accepted|confirmed/i).first()).toBeVisible();
 });
});
```

- [ ] **Step 2: Run the spec, fix as needed**

```bash
cd fe
./scripts/e2e.sh -- audit-closure/seller-journey
```

**Expected:** PASS.

- [ ] **Step 3: Commit**

```bash
git add fe/e2e/audit-closure/seller-journey.spec.ts
git commit -m "test(fe): add seller journey E2E spec"
```

### Task 3.6: Admin journey spec

**Files:**
- Create: `fe/e2e/audit-closure/admin-journey.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
/**
 * Admin journey: login → approve seller → moderate product → view dashboard.
 */
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin1@vnshop.test"; // seeded by reset-db
const ADMIN_PASS = "TestPass123!";

test.describe("admin journey", () => {
 test("login → approve seller → moderate product → view dashboard", async ({ page }) => {
 await page.goto("/login");
 await page.getByLabel("Email").fill(ADMIN_EMAIL);
 await page.getByLabel("Password").fill(ADMIN_PASS);
 await page.getByRole("button", { name: "Log in" }).click();

 // Admin link visible (spec UX Med #18)
 await expect(page.getByRole("link", { name: /^admin$/i })).toBeVisible();

 await page.getByRole("link", { name: /^admin$/i }).click();
 await expect(page).toHaveURL(/\/admin/);

 // Approve a pending seller
 await page.getByRole("link", { name: /sellers|approvals/i }).click();
 await page.getByRole("button", { name: /approve/i }).first().click();
 await expect(page.getByText(/approved/i).first()).toBeVisible();

 // Dashboard
 await page.getByRole("link", { name: /dashboard/i }).click();
 await expect(page.getByTestId("admin-dashboard")).toBeVisible();
 });
});
```

- [ ] **Step 2: Run, fix, commit**

```bash
cd fe
./scripts/e2e.sh -- audit-closure/admin-journey
git add fe/e2e/audit-closure/admin-journey.spec.ts
git commit -m "test(fe): add admin journey E2E spec"
```

### Task 3.7: A11y spec for the 11 items

**Files:**
- Create: `fe/e2e/audit-closure/a11y-11-items.spec.ts`

- [ ] **Step 1: Install axe-core (if not already)**

```bash
cd fe
npm install --save-dev @axe-core/playwright
```

- [ ] **Step 2: Write the spec**

```ts
/**
 * A11y spec: covers the 11 items closed in Phase 1b.
 * Spec: docs/superpowers/specs/2026-05-31-ui-ux-audit-fixes-design.md
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("a11y — 11 remaining items + axe scan", () => {
 test("HomePage: category tabs are fetched from API (not hardcoded)", async ({ page }) => {
 await page.goto("/");
 // Wait for the categories bar to populate from the API.
 const cats = page.getByTestId("category-tab");
 await expect(cats.first()).toBeVisible();
 expect(await cats.count()).toBeGreaterThan(2); // not the old hardcoded 11
 });

 test("HomePage: flash sale has scroll indicators", async ({ page }) => {
 await page.goto("/");
 await expect(page.getByTestId("flash-sale-prev")).toBeVisible();
 await expect(page.getByTestId("flash-sale-next")).toBeVisible();
 await expect(page.getByTestId("flash-sale-dots")).toBeVisible();
 });

 test("navbar: admin link hidden for buyer", async ({ page, context }) => {
 // Login as buyer (use seeded buyer)
 await page.goto("/login");
 // ... login flow ...
 await expect(page.getByRole("link", { name: /^admin$/i })).not.toBeVisible();
 await expect(page.getByRole("link", { name: /seller hub/i })).not.toBeVisible();
 });

 test("checkout: default payment is last-used (or COD)", async ({ page }) => {
 // Pre-set localStorage to VNPAY.
 await page.goto("/");
 await page.evaluate(() => localStorage.setItem("vnshop_last_payment_method", "VNPAY"));
 await page.goto("/checkout");
 await expect(page.getByTestId("payment-method-VNPAY")).toBeChecked();
 });

 test("login toast has Log in action button", async ({ page }) => {
 await page.goto("/cart");
 await page.getByRole("button", { name: /checkout/i }).click();
 // Should toast with action
 await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
 });

 test("axe scan: OrdersPage has no critical/serious a11y violations", async ({ page }) => {
 await page.goto("/orders");
 const results = await new AxeBuilder({ page })
 .withTags(["wcag2a", "wcag2aa"])
 .analyze();
 const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
 expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
 });
});
```

(Sub-agent expands to cover all 11 items; the above is a starting template.)

- [ ] **Step 3: Run, fix, commit**

```bash
cd fe
./scripts/e2e.sh -- audit-closure/a11y-11-items
git add fe/e2e/audit-closure/a11y-11-items.spec.ts fe/package.json fe/package-lock.json
git commit -m "test(fe): add a11y E2E spec covering the 11 items + axe scan"
```

### Task 3.8: Update e2e.sh to run all (new + existing) specs

**Files:**
- Modify: `fe/scripts/e2e.sh`

- [ ] **Step 1: Verify e2e.sh runs both new and existing**

The current `e2e.sh` (from Task 1.4) runs `npm run test:e2e` which uses `playwright.config.ts`'s `testMatch`. The `testMatch` from Task 3.3 already includes both the new `audit-closure/*.spec.ts` and the existing `workday-*.spec.ts` + `buyer-happy-path.spec.ts`.

No change needed. If a sub-agent needs to filter:

```bash
# Run only new specs:
docker compose -f docker-compose.verify.yml --profile e2e run --rm fe-e2e \
 npx playwright test e2e/audit-closure

# Run only existing regression:
docker compose -f docker-compose.verify.yml --profile e2e run --rm fe-e2e \
 npx playwright test e2e/workday-buyer.spec.ts e2e/workday-seller.spec.ts e2e/workday-admin.spec.ts e2e/buyer-happy-path.spec.ts

# Run everything (default):
./scripts/e2e.sh
```

- [ ] **Step 2: Run the full E2E suite from clean state**

```bash
cd fe
docker compose -f docker-compose.verify.yml down -v
./scripts/e2e.sh
```

**Expected:** all specs pass (new + existing).

- [ ] **Step 3: Verifier sub-agent**

The verifier re-runs `./scripts/e2e.sh` from clean state. If any spec fails, the verifier rejects and the appropriate Phase 3 sub-agent fixes and re-runs.

---

## Phase 4: Final closure

### Task 4.1: Generate the audit-closure report

**Files:**
- Create: `docs/superpowers/specs/2026-06-13-fe-audit-closure-report.md`

- [ ] **Step 1: Run the full verify + E2E from clean state**

```bash
cd fe
docker compose -f docker-compose.verify.yml down -v
./scripts/verify.sh
./scripts/e2e.sh
```

**Expected:** all green. Capture the full output.

- [ ] **Step 2: Walk the Phase 0 status matrix and update statuses**

For every row in `docs/superpowers/specs/2026-06-13-audit-111-status-matrix.md`:
- `OPEN` → should now be `FIXED` (Phase 1) or `DEFERRED` (with rationale).
- `REGRESSED` → should now be `FIXED` (Phase 1).
- `OBSOLETE` → unchanged.

- [ ] **Step 3: Generate the report**

```markdown
# VNShop FE Audit Closure Report

Generated: 2026-06-13
Branch: fix/audit-closure-e2e
Spec: docs/superpowers/specs/2026-06-13-fe-audit-closure-e2e-design.md

## Summary

| Phase | Status | Notes |
|---|---|---|
| 0 — re-verify 111 items | ✅ | Status matrix at docs/superpowers/specs/2026-06-13-audit-111-status-matrix.md |
| 1a — Docker scaffolding | ✅ | Dockerfile.verify, Dockerfile.e2e, docker-compose.verify.yml, verify.sh, e2e.sh |
| 1b — fix remaining items | ✅ | N items closed (see OPEN_ITEMS.md "Closed" section) |
| 2 — domain audit | ✅ | N mismatches found, all fixed; guard test green |
| 3 — E2E | ✅ | 4 new specs + existing workday-* + buyer-happy-path all pass |
| 4 — closure | ✅ | This report |

## Coverage matrix (all 111 items)

| Status | Count | Items |
|---|---|---|
| ✅ FIXED | (count) | (list) |
| ⚠️ DEFERRED | (count) | (list with rationale) |
| ❌ MISSED | 0 | — |

## Domain audit

| Domain | Mismatches found | Fixed | Test |
|---|---|---|---|
| PaymentMethod | (count) | (count) | domain-usage.test.ts |
| CouponType | (count) | (count) | domain-usage.test.ts |
| FREE_SHIPPING_THRESHOLD | (count) | (count) | domain-usage.test.ts |
| FLAT_SHIPPING_FEE | (count) | (count) | domain-usage.test.ts |
| Currency formatting | (count) | (count) | domain-usage.test.ts |

## E2E results

| Spec | Status | Time |
|---|---|---|
| buyer-journey.spec.ts | ✅ | (Xs) |
| seller-journey.spec.ts | ✅ | (Xs) |
| admin-journey.spec.ts | ✅ | (Xs) |
| a11y-11-items.spec.ts | ✅ | (Xs) |
| workday-buyer.spec.ts (regression) | ✅ | (Xs) |
| workday-seller.spec.ts (regression) | ✅ | (Xs) |
| workday-admin.spec.ts (regression) | ✅ | (Xs) |
| buyer-happy-path.spec.ts (regression) | ✅ | (Xs) |

## Build status

`./scripts/verify.sh`: ✅ green from clean state.
`./scripts/e2e.sh`: ✅ green from clean state.

## Deferred items

(List any items marked DEFERRED with rationale. The list should be empty in the ideal case.)

## Out of scope reminders

- Java 25 vs 21 audit (backend, not in 111-item FE spec).
- 2026-06-06 frontend-redesign migration (separate spec).
- Full WCAG certification (requires manual AT testing).
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-13-fe-audit-closure-report.md
git commit -m "docs(audit): Phase 4 — final FE audit closure report"
```

### Task 4.2: Final verifier sub-agent

**Files:** none (read-only)

- [ ] **Step 1: Verifier re-runs the full gate**

```bash
cd fe
docker compose -f docker-compose.verify.yml down -v
./scripts/verify.sh
./scripts/e2e.sh
```

- [ ] **Step 2: Verifier reads the closure report and confirms every claim**

- [ ] **Step 3: Verifier outputs a pass/fail summary**

If the verifier reports green, the user (you) merges `fix/audit-closure-e2e` into `main` per the spec.

If the verifier reports red, identify which phase is failing, dispatch a sub-agent to fix, and re-run.

---

## Done criteria

- [x] Phase 0 status matrix committed.
- [x] Phase 1a Docker scaffolding committed and green on `main`.
- [x] Phase 1b: every row in `OPEN_ITEMS.md` marked closed or deferred.
- [x] Phase 2: domain audit report + guard test, all green.
- [x] Phase 3: 3 new journey specs + a11y spec + existing regression all pass.
- [x] Phase 4: closure report committed.
- [x] Final verifier sub-agent: green.
- [x] `./scripts/verify.sh` and `./scripts/e2e.sh` are green from `docker compose down -v`.















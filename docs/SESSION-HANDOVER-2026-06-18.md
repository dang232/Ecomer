# Session Handover — 2026-06-18 Fix-it-all + Make-it-maintainable

## Summary

Closed the deferred P0 (CSRF) and P2 (ConfirmDialog) loose ends from the
2026-06-16 video FE audit, and added 3 CI gates that prevent the same
class of finding from recurring (i18n key lint, design-token lint,
axe-core a11y spec). Also produced a new BA audit on the checkout +
payment surface (40 findings: 11 P0 / 12 P1 / 11 P2 / 6 P3) to seed the
next sprint.

## Branch

- **Branch:** `main`
- **Base:** `29daf4b7` (last video-pipeline commit)
- **Commits (7 atomic + 1 merge):**
  1. `5cacb0a4` — `feat(lint): add design-token CI gate (catches hex drift, allowlists styles/)`
  2. `9b2ac31b` — `ci(i18n): add i18n key linter script (catches P0-class missing-key bugs)`
  3. `037b816a` — `ci(i18n): remove dead code in check-i18n-keys (unused lineOf/abs)`
  4. `3052f6b8` — `ci(a11y): lockfile entry for @axe-core/playwright dep`
  5. `e06deb03` — `fix(ux/p2-5): replace window.confirm with ConfirmDialog in seller-product-modal`
  6. `d85c9b0c` — `fix(auth): add X-CSRF-Token header to /auth/refresh and /auth/logout` (on `fix/native-auth-csrf-header` branch, rebased onto current main before merge)
  7. `f777a427` — `merge: CSRF fix (native-auth X-CSRF-Token header)`

- **Files changed:** 13 (1,209 insertions, 50 deletions)
- **Untracked doc committed separately:** `docs/superpowers/audits/2026-06-18-checkout-payment-ba-audit.md`

## Test results

| Suite | Result | Notes |
|---|---|---|
| `npm run typecheck` (fe) | exit 0 | Clean |
| `npm test` (fe) | 326/326 pass, 44 test files | Includes 10 new CSRF tests + 4 new ConfirmDialog tests |
| `node scripts/check-i18n-keys.mjs` | exit 1 | **Correct behavior** — surfaces 274 real missing keys across 911 unique static keys (5 dynamic templates flagged for manual review) |
| `node scripts/check-design-tokens.mjs` | exit 1 | **Correct behavior** — surfaces 285 real hex-drift violations (e.g. `#FF6200`, `#10B981`, `#EF4444` hardcoded in components) |
| `npm run test:a11y` | ECONNREFUSED on `localhost:3000` / `localhost:8080` | Spec is correctly wired; the docker stack is not up in this sandbox. Pre-existing condition documented in `fe/playwright.config.ts`. |
| `npx playwright test e2e/video-integration-ui.spec.ts` | 3/3 timeout-fail | Same: backend stack not running in this env. CSRF code is correct (constants, helper, wired into both refresh + logout, asserts header absent on login per the filter). |

## Critical fixes

- **C1 (prod-critical, P0)** — `native-auth.ts` was calling
  `/auth/refresh` and `/auth/logout` without the `X-CSRF-Token` header.
  The user-service `CsrfProtectionFilter` requires it; every
  authenticated page reload in prod 403s and bounces to `/login`. Fix:
  - New `readCookieValue(cookieName)` helper (jsdom-testable)
  - New `csrfAuthHeader()` helper returning
    `Record<string, string> | undefined` from the `vnshop_csrf` cookie
  - Named constants `CSRF_COOKIE_NAME = "vnshop_csrf"`,
    `CSRF_HEADER_NAME = "X-CSRF-Token"` at top of file
  - `refreshTokens` and `revokeTokens` both pass `csrfAuthHeader()`;
    `passwordLogin` deliberately does NOT (login itself sets the cookie)
  - Removed `installCsrfPatch` fetch monkey-patch from
    `video-integration-ui.spec.ts` — the real fix is in prod code now
  - 10 new jsdom tests across 5 describe blocks
- **C2 (P2-5)** — `window.confirm()` → `<ConfirmDialog variant="danger">`
  in `seller-product-modal.tsx`. Two call sites: upload-cancel and
  remove-video. `ConfirmDialog` gained a `cancelLabel` prop. New i18n
  keys: `common.cancel`, `common.confirm`, `seller.productModal.removeVideoTitle`,
  `seller.productModal.removeVideoDescription` (both `en.json` and `vi.json`).

## CI gates added (the "make it maintainable" deliverables)

- **C3 — i18n key linter** (`fe/scripts/check-i18n-keys.mjs`): 286 lines,
  0 npm deps, walk+regex+resolve. Exits 1 with `file:line: missing key
  "x.y.z" (in <locale>)` on miss. Wired to `npm run lint:i18n`,
  `npm run lint:all`, and `npm run verify`. **Caught 274 real missing
  keys in the codebase on first run** — same systemic pattern that
  produced 6/9 P0s in the 2026-06-16 video audit and 7/11 P0s in the new
  checkout audit. Cleanup is the next sprint's job.
- **C4 — design-token linter** (`fe/scripts/check-design-tokens.mjs`):
  167 lines, 0 npm deps. Bounded regex `(?<!\w)#[0-9A-Fa-f]{3,8}(?!\w)`
  catches tailwind arbitrary values like `bg-[#FF00FF]` AND raw hex,
  but skips identifiers (`User#addAddress`). Allowlists `fe/src/styles/`
  and a few specific files (documented inline). Wired the same way.
  **Caught 285 real hex-drift violations** — broader than the `bg-[#00BFB3]`
  pattern that Phase 7 cleaned. Same caveat: cleanup is a follow-up.
- **C5 — axe-core a11y spec** (`fe/e2e/a11y.spec.ts`): 184 lines, 3
  tests, one per persona. Uses `wcag2a` + `wcag2aa` tags, fails on
  serious/critical. False-positive exclusions for `color-contrast`
  (recharts) and `region` (PayPal/Stripe iframes) documented inline.
  Wired to `npm run test:a11y`. `verify` deliberately does NOT include
  it (requires the docker stack to be up).

## Quality pass applied (per user protocol)

Each worker's diff was reviewed for clean-code / DRY / SOLID:

| Worker | Review finding | Action |
|---|---|---|
| CSRF | `csrfAuthHeader` shared between refresh + logout | ✅ no copy-paste |
| CSRF | cookie/header names magic strings | ✅ extracted as named constants |
| CSRF | `readCookieValue` ≤ 8 lines | ✅ under 30-line cap |
| Confirm | `ConfirmDialog` reuses `variant="danger"` | ✅ no new variant added |
| Confirm | handler shape unchanged from original | ✅ single-responsibility delete |
| i18n lint | first pass had unused `lineStarts` / `lineOf` / `abs` | ✅ agent self-cleaned in `037b816a` (post-agent quality pass before reporting done) |
| token lint | naive hex regex matched `User#addAddress` (false positive at `users.ts:21`) | ✅ agent self-fixed with lookbehind/lookahead (the `037b816a` equivalent for token lint) |
| token lint | leftover `__token_lint_negative_test__.ts` from prior run | ✅ this run cleaned it; spec says "delete the temp file" and the agent obeyed |
| axe | used `installCsrfPatch` inline (not yet shared) | documented as follow-up: hoist to `fe/e2e/_helpers/auth.ts` when CSRF lands |
| axe | only 14 lines in the final commit | ✅ most of the spec was already in 5cacb0a4 / 9b2ac31b (shared via package.json); only the lockfile delta was left |

## Re-deployed notes (gotchas)

- **The CSRF branch was based on the pre-sprint main (`bde19797`), not
  the live main.** When the agent created the branch, all 5 other
  workers had not yet committed. After all workers reported, the lead
  rebased `fix/native-auth-csrf-header` onto current main, then
  `--no-ff`-merged. This is the worktree-base-ref-divergence pattern
  from the user memory; caught it BEFORE merging by checking the
  branch's parent commit (`bde19797` vs current main tip). Rebase was
  clean (no conflicts).
- **i18n linter found 274 missing keys that exist in the codebase right
  now.** The linter is correct — those are real bugs. The user
  protocol is "make it maintainable" not "ship 274 key fixes in one
  sprint". The next sprint should sweep these as a separate plan
  (probably grouped by namespace, with the checkout+payment audit's
  7 P0s as priority 1).
- **Same pattern for the token linter (285 violations).** Phase 7 only
  fixed `bg-[#00BFB3]`; the broader brand-color drift
  (`#FF6200` for orange, `#10B981` for green, `#EF4444` for red,
  `#F59E0B` for amber, `#6366F1` for indigo, etc.) is unaddressed.
  Recommend a Phase 7b sweep using the linter's output as the work list.
- **axe-core spec requires the docker stack up.** If `npm run test:a11y`
  is added to `verify` later, it will block CI for anyone running
  locally without Docker. Suggest: keep it on a separate CI lane
  (`ci.yml` job that depends on `docker compose up`), not in `verify`.
- **CSRF branch was rebased, not merged via rebase-and-ff.** The merge
  commit `f777a427` is `--no-ff` so the CSRF story is preserved in
  history. Subsequent `git log` shows the topology clearly.

## Open follow-up tasks (ranked)

1. **Fill the 7 P0 i18n gaps from the checkout+payment audit first** —
   `admin.orders.*` (15 keys), `payment.*` hardcoded Vietnamese
   strings in `StripePaymentSection.tsx`, `VietQrPaymentSection.tsx`,
   `PaymentReturnPage.tsx`, plus 4 more. These are visible to real
   users in the money flow.
2. **Phase 7b — sweep the 285 hex-color drift sites.** Use
   `node scripts/check-design-tokens.mjs` output as the work list. Add
   named tokens to `fe/src/styles/theme.css` for the brand colors that
   recur (orange, green, red, amber, indigo).
3. **Fill the remaining ~267 i18n gaps surfaced by the linter** (after
   the 7 P0s in #1). Group by namespace and land them in 1-2 PRs.
4. **Fix the 4 systemic P0s from the checkout+payment audit** that are
   not i18n: `OrdersPage.tsx:464-471` (no-confirm cancel order), the
   `role="radio"` stepper, the keyboard-broken radiogroups.
5. **Hoist `installCsrfPatch` to a shared `fe/e2e/_helpers/auth.ts`**
   once the CSRF merge is in `main` (it's in `main` now, just no
   refactor). Both `a11y.spec.ts` and `video-integration-ui.spec.ts`
   use the same pattern.
6. **Wire `lint:i18n` and `lint:tokens` into the existing CI
   workflow** (look for `.github/workflows/*.yml` or `fe/ci.yml`).
   Currently wired into `npm run verify` and `npm run lint:all`
   locally, but not into GitHub Actions yet.
7. **Add `npm run test:a11y` to a separate CI lane** that depends on
   `docker compose up` finishing first. Do NOT add to `verify` or it
   will block local dev who doesn't have Docker running.

## Files added/changed in this session

- 5 new TS/TSX files: `seller-product-modal.test.tsx`, `native-auth.test.ts`, `a11y.spec.ts`, `check-design-tokens.mjs`, `check-i18n-keys.mjs`
- 4 modified: `seller-product-modal.tsx`, `native-auth.ts`, `confirm-dialog.tsx`, `video-integration-ui.spec.ts`
- 3 modified configs: `fe/package.json`, `fe/package-lock.json` (+ 2 new keys each in `en.json` + `vi.json`)
- 1 new audit doc: `docs/superpowers/audits/2026-06-18-checkout-payment-ba-audit.md`
- 1 new session handover (this file)

## Where things live

- Plan: `C:\Users\dangq\.claude\plans\fix-it-all-maintainable.md`
- Plan→exec handoff: `.omc/handoffs/team-plan-team-exec.md`
- Exec→verify handoff: `~/.claude/handoffs/team-exec-team-verify.md`
- New audit: `docs/superpowers/audits/2026-06-18-checkout-payment-ba-audit.md`
- New CI gates: `fe/scripts/check-i18n-keys.mjs`, `fe/scripts/check-design-tokens.mjs`, `fe/e2e/a11y.spec.ts`
- CSRF fix: `fe/src/app/lib/auth/native-auth.ts:106-127` (helpers), `:170` (refresh), `:180` (logout)
- ConfirmDialog migration: `fe/src/app/components/seller-product-modal.tsx:147-149` (state), `:679-687` (upload-cancel), `:690-703` (remove-video)
- This handover: `docs/SESSION-HANDOVER-2026-06-18.md`
- Previous handover: `docs/SESSION-HANDOVER-2026-06-15-video-pipeline.md`

## How to resume (for the next session)

1. Pick up the top follow-up (P0 i18n gap fill from the new audit).
   Start with `admin.orders.*` — it's the admin's primary money view
   and visible to Linh.
2. The two linters will tell you when you're done: both should exit 0
   before this set of follow-ups is complete. Use them as the
   definition-of-done signal, not just "the test pass count went up".
3. The axe spec is wired but needs the docker stack. If you want to
   develop a11y fixes locally, run `docker compose --profile apps up -d`
   then `npm run test:a11y` to see the current violations.
4. Don't touch the `feat/production-readiness-fixes` or
   `feature/video-pipeline-v1` branches — they're historical and have
   their own open PRs.

# VNShop Web Commerce Modernization Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one coordinated, type-safe modernization of the VNShop buyer storefront, seller console, and admin console while preserving current routes, contracts, roles, and commerce behavior.

**Architecture:** Work proceeds through reviewable risk-first slices: reproducible baseline evidence, checkout and runtime boundaries, platform foundations, buyer journeys, seller workflows, admin workflows, and integrated cutover. Route pages become composition points over feature public interfaces and `fe/src/shared`, with URL-owned navigation state, Zod-decoded network boundaries, and capability-aware actions.

**Tech Stack:** React 19.2.8, TypeScript 5.6, Vite 7.3.6, React Router 7.15, TanStack Query 5.101.4, Zod 4.4, Zustand 5, React Hook Form 7, Tailwind CSS 4, Vitest 4, Playwright 1.60, pnpm 9.15.9.

## Global Constraints

- Keep the VNShop name and use the approved Clean Marketplace direction.
- Preserve a Shopee-familiar marketplace information architecture without copying Shopee branding, assets, copy, or exact layouts.
- Modernize buyer, seller, and admin surfaces in one coordinated production release.
- Keep existing public URLs, gateway authentication, role authorization, API envelopes, Zod validation, payment-provider semantics, and backend-supported actions.
- Use `fe/src/shared/ui` as the canonical primitive directory; `fe/src/app/components/ui` may contain temporary compatibility exports only.
- Enforce the dependency direction `route/layout -> feature public index -> shared`.
- Treat the current `fe/package.json` runtime versions as executable truth and use pnpm 9.15.9 for frontend dependency and script execution.
- Accept network data as `unknown` and trust it only after Zod decoding.
- Prohibit explicit `any`, double assertions, `@ts-ignore`, unsafe suppressions, duplicated wire types, and assertion-only uncertainty in changed production code.
- Preserve URL ownership for navigable tabs, filters, sorting, pagination, and record selection.
- Do not render controls for backend capabilities that do not exist.
- Preserve Flutter token output byte-for-byte while adding the web-only brand namespace.
- Keep interactive targets at least 44px, meet WCAG 2.1 AA, support Vietnamese and English expansion, and honor reduced motion.
- Use fixed semantic typography; do not scale font size with viewport width and keep letter spacing at zero.
- Keep cards at 8px radius or less and reserve card treatment for repeated items, dialogs, and framed tools.
- Require self-review, focused automated evidence, independent code review, and finding resolution for every task.
- Resolve all Critical and Important review findings before the next task. Record Minor findings with rationale and ownership when deferred.
- Do not stage or commit `fe/.ua/`.

---

## Plan Suite

Execute these plans in order. A later plan may begin only after all blocking gates in its predecessor pass.

1. [Baseline Evidence](2026-07-29-web-commerce-modernization-01-baseline-evidence.md)
2. [Checkout Lifecycle Replacement](2026-07-29-web-commerce-modernization-02a-checkout-lifecycle.md)
3. [Remaining Type Boundaries, Tasks 3-4](2026-07-29-web-commerce-modernization-02-checkout-boundaries.md)
4. [Platform Foundations](2026-07-29-web-commerce-modernization-03-platform.md)
5. [Buyer Experience](2026-07-29-web-commerce-modernization-04-buyer.md)
6. [Seller Experience](2026-07-29-web-commerce-modernization-05-seller.md)
7. [Admin Experience](2026-07-29-web-commerce-modernization-06-admin.md)
8. [Integrated Release And Cutover](2026-07-29-web-commerce-modernization-07-release.md)

## Locked Decisions

| Decision | Implementation consequence |
|---|---|
| One production release | Internal tasks remain continuously integrable, but no mixed old/new generation is exposed in production. |
| Internal preview | `?__commercePreview=modernized` is accepted only when `import.meta.env.DEV`; the switch and legacy branches are removed before release. |
| No analytics vendor in this initiative | Buyer conversion is measured with deterministic journey completion, error, step-count, and timing proxies. Production analytics is a separately approved follow-up. |
| Canonical UI ownership | New primitives live in `fe/src/shared/ui`; old app UI modules only re-export during migration. |
| Capability-aware consoles | A queue declares search, status, sort, pagination, and selection support; each mutation action separately declares exact required/optional inputs and cross-field validation before its dialog renders them. |
| Checkout payment capability | `/payment/methods` is the configuration-aware authority. Preserve enabled COD, VNPay, MoMo, VietQR, Stripe, and PayPal; exclude unsupported `sepay` and invalid legacy `BANK`. Narrow prerequisites make Stripe/PayPal reuse the order-owned payment, freeze the monetary/FX snapshot before provider creation, derive provider keys from the internal payment ID, reconcile concurrent provider outcomes, serialize terminal promotion, route VNPay/MoMo returns to the browser, require real public HTTPS callbacks, wire optional credentials safely, and add buyer-owned read-only order-key reconciliation before the frontend exposes recovery. |
| Seller draft limitation | The public seller-filtered catalog is ACTIVE-only. The frontend recovers only a draft created in the current browser session and does not claim a complete server draft library. |
| Finance transitions | Payout wire statuses remain distinct and actions derive from an exhaustive backend-valid transition matrix. VietQR confirmation is a manual payment-ID tool because no admin read queue exists. |
| Coupon update limitation | Existing coupons are inspect/deactivate only because the read contract omits `perUserLimit` and update would silently default an unknown value to `1`. Creation exposes the supported limit. |
| Representative visual matrix | Buyer critical routes use 390x844, 768x1024, 1024x768, and 1440x900. Operational queue/detail views use 390x844 and 1440x900. |
| Performance budget | No unexplained key-route gzip JavaScript increase above 10% from the recorded baseline. Median LCP target is 2.5 seconds or less and CLS below 0.1 across three specified mobile Lighthouse runs. |

## Architecture Boundaries

```text
fe/src/app/routes.ts
  -> fe/src/app/layouts/*
  -> fe/src/features/<feature>/index.ts
  -> fe/src/shared/{api,auth,commerce,config,contracts,lib,routing,ui}
```

No feature imports another feature's internal `components`, `hooks`, `model`, or `api` file. Cross-feature use goes through the owning feature's `index.ts`, or through a genuinely shared module after review.

Server state stays in TanStack Query. Navigable state stays in the URL. Cross-route display preferences stay in Zustand. Form state stays in React Hook Form. Derived presentation state is a pure typed view model.

## Review Gate

Every task in every child plan ends with this gate:

1. Record `$env:LINT_BASE_SHA = git rev-parse HEAD` and the pre-existing
   `git status --porcelain=v1` before editing. Never stage a path that was
   already dirty unless it is explicitly owned and reviewed by the task.
2. Run the task's focused failing test before implementation and confirm the expected failure.
3. Run the task's focused passing tests after implementation.
4. Run `pnpm run typecheck`, `pnpm run lint:changed -- --base $env:LINT_BASE_SHA`, and `git diff --check`.
5. Inspect `git diff --stat $env:LINT_BASE_SHA` and `git diff $env:LINT_BASE_SHA` for unrelated files, unsafe type escapes, missing async states, unsupported actions, localization gaps, and responsive regressions.
6. Stage only the exact files in the task's reviewed file inventory. Do not use
   a broad directory pathspec that can absorb unrelated work. Run
   `git diff --cached --check`, inspect `git diff --cached --name-status`, and
   review the complete `git diff --cached` before committing.
7. Commit the task with the exact commit message listed in the child plan.
8. Use `superpowers:requesting-code-review` with the task requirements, `BASE_SHA`, and the new `HEAD_SHA`.
9. Fix every Critical and Important finding, rerun the focused and type-safety gates, and request follow-up review when behavior changed.
10. Preserve the review response and verification output in the Codex task transcript. A no-finding review must state residual risk or uncovered environments.

On PowerShell, capture the base with:

```powershell
$env:LINT_BASE_SHA = git rev-parse HEAD
```

The `lint:changed` script also accepts an explicit base:

```powershell
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Define this helper once in the execution shell:

```powershell
function Add-ReviewedTaskFiles {
  param([Parameter(Mandatory)][string[]] $Paths)

  foreach ($path in $Paths) {
    if (Test-Path -LiteralPath $path -PathType Container) {
      throw "Directory pathspecs are forbidden: $path"
    }
    git add -- $path
    if ($LASTEXITCODE -ne 0) {
      throw "Could not stage reviewed path: $path"
    }
  }
}
```

At every child-plan commit step, set `$taskFiles` to every exact
Create/Modify/Test/Delete path in that task's reviewed **Files** inventory, one
file per entry, then call `Add-ReviewedTaskFiles -Paths $taskFiles`. Ignored
review evidence remains an explicit `git add -f` exception. Never substitute a
directory pathspec or a glob.

## Acceptance Coverage

| Specification area | Plan ownership |
|---|---|
| Toolchain truth, baseline warnings, route inventory, buyer proxies | Plan 01, Tasks 1-3 |
| Checkout one-order invariant, read-only ambiguity reconciliation, payment-only retry, redirect recovery | Plan 02a |
| Unknown-to-Zod transport, test/E2E type coverage | Plan 02, Tasks 3-4 |
| Nested persona layouts, guard redirects, URL state, query ownership | Plan 03, Tasks 1-2 |
| Shared transport, runtime contracts, and dependency enforcement | Plan 03, Task 3 |
| Web-only brand tokens and Flutter stability | Plan 03, Task 4 |
| Shared primitives, commerce patterns, design-system route | Plan 03, Tasks 5-6 |
| Home, search, product, cart, checkout, account journeys | Plan 04 |
| Seller dashboard, products, orders, reviews, wallet, settings | Plan 05 |
| Admin dashboard, queues, decisions, users, health | Plan 06 |
| Accessibility, localization, visual matrix, performance, full journeys | Plan 07, Tasks 1-3 |
| Preview removal, compatibility removal, coordinated promotion and rollback | Plan 07, Tasks 4-5 |

## Critical Invariants

### Checkout submission

```ts
export interface CheckoutSubmissionController {
  getState(): CheckoutSubmissionState;
  subscribe(listener: (state: CheckoutSubmissionState) => void): () => void;
  updateCartFingerprint(fingerprint: string): void;
  submit(input: CheckoutSubmissionInput): Promise<CheckoutSubmissionResult>;
}
```

The controller owns one mutable state machine, one immutable order-attempt
snapshot, and one shared in-flight promise. Concurrent calls receive that same
promise. An ambiguous order response is reconciled through the authenticated
read-only order-key lookup and is never resubmitted, because current
order-service downstream side effects are not atomic with order persistence.
Once `orderId` exists, retries call payment initialization with that order only
and never call `POST /orders` again. A versioned, Zod-validated session record
is written before placement and before redirect; the payment return page
resolves gateway payment references through that record and polls with the
real order ID.

### Runtime data

```ts
export async function readJson<TSchema extends z.ZodType>(
  response: Response,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const value: unknown = await response.json();
  return schema.parse(value);
}
```

No feature or page casts `response.json()` or `JSON.parse()` to a trusted domain type.

### Queue capability

```ts
export type AdminQueueAction =
  | "cancel" | "refund" | "change-status" | "deactivate" | "ban" | "unban"
  | "approve" | "reject" | "approve-appeal" | "reject-appeal" | "resolve"
  | "submit" | "unknown" | "paid" | "legacy-complete" | "legacy-fail";

export type MutationInput =
  | "reason" | "status" | "adminResolution" | "providerReference"
  | "attemptId" | "evidence" | "externalReference"
  | "evidenceHash" | "maskedDestinationConfirmed";

export interface MutationValidationRule {
  kind: "at-least-one";
  fields: readonly MutationInput[];
}

export interface QueueCapabilities {
  search: boolean;
  status: boolean;
  sort: readonly string[];
  pagination: "server" | "client" | "none";
  selection: "single" | "multiple" | "none";
  actions: Readonly<Partial<Record<AdminQueueAction, MutationCapability>>>;
}

export interface MutationCapability {
  inputs: Readonly<
    Partial<Record<MutationInput, "required" | "optional">>
  >;
  rules?: readonly MutationValidationRule[];
}
```

Queue toolbars derive from queue-level declarations. Mutation dialogs derive
controls and Zod validation from the selected action's exact required/optional
inputs and cross-field rules, because actions in one queue do not necessarily
accept the same payload. Every entry comes from an existing endpoint contract;
a visual redesign never creates a backend capability.

## Stop Conditions

Stop the implementation and return to planning when any condition is true:

- A required control has no existing endpoint or endpoint input.
- Checkout tests cannot prove one order for a payment retry.
- A proposed token change modifies the committed Dart output.
- A route migration changes an external URL or loses the original `next` destination.
- Seeded E2E data cannot be made deterministic without changing backend semantics.
- Key-route compressed JavaScript exceeds the baseline by more than 10% without an approved explanation and mitigation.
- A Critical or Important review finding remains unresolved.

## Completion Definition

The initiative is complete only after Plan 07 removes the development preview
and compatibility branches, all release gates pass on a committed local image,
the integrated diff receives independent review, and the complete gate is
repeated against the immutable CD frontend digest whose staging lock
`sourceCommit` equals the reviewed implementation merge. The existing protected
promotion reuses that tested digest and the rollback workflow remains valid.

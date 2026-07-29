# VNShop Web Commerce Modernization Plan Review

**Date:** 2026-07-29
**Review base:** `8c7cbc5b`
**Scope:** approved design specification, master plan, and eight executable
child plans (nine plan files including the master)

## Review Method

The plan was produced through Hyperplan's five-role, three-round adversarial
workflow and a dedicated planner handoff. The native surface did not expose the
named role selectors, so five default Codex subagents were used while preserving
the skeptic, validator, researcher, architect, and creative role contracts.
Adversarial distillation retained 34 findings, refined 10 challenged findings,
and dropped none as unsupported.

After formalization, three independent follow-up reviewers examined separate
risk areas:

- James: checkout lifecycle, provider replay, and frontend type safety.
- McClintock: release provenance, exact-image verification, and browser gates.
- Hooke: buyer/seller/admin contracts and unsupported UI claims.

Every Critical or Important finding was returned to its owning task, corrected,
and sent back to the same reviewer for another focused pass.

## Findings Resolved

### Checkout And Providers

- Separated order placement from payment retry and prohibited browser
  resubmission after an ambiguous order response.
- Added authenticated buyer-owned read-only order-key reconciliation.
- Made the trusted internal payment ID the provider idempotency identity.
- Froze external amount, currency, FX rate, and quote time under a database lock
  before provider creation so retries cannot change monetary parameters.
- Modeled concurrent PayPal create/capture loser responses and bounded provider
  reconciliation rather than assuming simultaneous calls both succeed.
- Required nested PayPal capture-ID extraction, minimal-response order lookup,
  and recovery after provider success plus internal promotion rollback.
- Serialized terminal promotion so payment, ledger, and callback outbox effects
  occur once.
- Made VietQR fail closed without a complete bank target and kept redirect
  providers disabled until a real public HTTPS callback origin and credentials
  exist.

### Type Safety

- Added strict app, test, and E2E TypeScript projects and typed lint coverage.
- Required `unknown` at network and storage boundaries with Zod decoding before
  domain use.
- Replaced text-only unsafe-code checks with TypeScript and
  `@typescript-eslint/parser` AST inspection, including TSX trailing comments.
- Inventoried every current production suppression file and prohibited scanner
  allowlists.
- Centralized seeded E2E persona credentials, removed implicit test-password
  defaults, and added an AST policy check for protected test logins.

### Product Contracts

- Locked all 32 buyer, seller, and admin acceptance routes to the real router.
- Removed unsupported seller verification, seller draft-library, review reply,
  coupon update, buyer support, queue filtering, and admin mutation claims.
- Derived seller and admin actions from exact backend inputs, status
  transitions, and cross-field validation rules.
- Preserved one Shopee-familiar marketplace information architecture while
  keeping VNShop's distinct visual identity and current backend behavior.

### Release And Provenance

- Bound visual baselines and comparison to one digest-pinned Playwright Linux
  image and platform-specific snapshots.
- Kept browser-visible local visual origins on `localhost` through tested
  container-local reverse proxies, preserving runtime URL validation and CORS.
- Built the candidate image from a detached worktree at the exact reviewed
  source commit and required OCI provenance verification after registry login.
- Locked staging to the immutable candidate digest and made protected promotion
  reuse the same digest after the complete browser, accessibility, bundle, and
  Lighthouse gate.
- Required exact workflow-run identity, bounded readiness polling, deterministic
  route bundle accounting, and no selected Playwright skips.

## Verification

- Acceptance inventory parity: 32 specification routes and 32 implementation
  inventory routes, with no differences or duplicates.
- Master links: all eight child-plan links resolve.
- Plan structure: nine plan files; 94 PowerShell blocks parse successfully.
- Markdown: balanced fences and no trailing whitespace.
- Staging policy: task commits use exact reviewed file inventories; ignored
  review artifacts are the only documented force-add exception.
- Frontend aggregate typecheck: `pnpm exec tsc -b --noEmit` passed; the final
  Windows rerun used the equivalent local `node_modules/.bin/tsc.cmd` entry
  because the PowerShell `pnpm.ps1` shim was blocked by execution policy.
- Repository diff check: passed.

## Residual Execution Risks

- These documents are implementation plans, not the frontend implementation.
- Provider sandbox/live credentials, sealed Kubernetes secrets, and real public
  callback origins must be supplied and validated during execution.
- Visual snapshots and Lighthouse baselines must be generated from the locked
  implementation revision, reviewed, and committed during execution.
- Protected staging and promotion workflows can be fully exercised only after
  the implementation image and environment exist.

## Disposition

Final focused follow-up review by James, McClintock, and Hooke found no
unresolved Critical or Important findings. The plan set is ready for execution;
implementation, provider credentials, protected staging, visual baselines, and
promotion evidence remain execution-phase work.

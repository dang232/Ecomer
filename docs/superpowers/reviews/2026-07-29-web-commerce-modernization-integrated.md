# VNShop Commerce Modernization Integrated Review

**Date:** 2026-08-01
**Source head:** `3373776d52843e541e2f058b321b17c3ef08e7ce`
**Disposition:** local release candidate; not approved for protected promotion

## Completed Locally

- Seller acceptance navigation uses real URL links and seller settings accepts
  the backend `LEGACY_MIGRATED` state.
- Seller order persistence avoids the nested bag fetch failure and has a
  passing Testcontainers regression when services are available.
- Seller and admin queues use semantic headings, URL-owned navigation, and
  capability-aware controls.
- Checkout, returns, profile, seller queue and review, wallet, and admin
  dashboard or review accessibility defects found by Axe have source fixes and
  focused regression coverage.
- Seller and admin route modules are lazy-loaded from `fe/src/app/routes.ts`,
  and stable third-party dependencies are separated into vendor chunks in
  `fe/vite.config.ts`. The production build has no chunk-size warning and fresh
  route bundle growth is within the 10% budget.
- Cutover policy, cutover-gate contract, E2E credential audit, E2E typecheck,
  release workflow policy tests, typecheck, lint, changed-file lint with zero
  warnings, format, build, and the full frontend unit suite pass locally.

## Verification Summary

| Gate | Result |
|---|---|
| Unit tests | 177 files, 1,017 tests passed |
| Focused accessibility repair tests | 6 files, 19 tests passed |
| Typecheck | Passed |
| Lint and policy checks | 0 lint errors; changed-file lint passes with zero warnings; known repository warnings remain |
| Production build | Passed |
| Bundle comparison | Passed; 5.0% to 6.5% gzip growth |
| Browser persona batches | Previously passed: buyer/seller/cross-persona 12/12, admin 9/9, seller focus 6/6 |
| Corrected browser Axe rerun | Blocked by Docker outage |
| Lighthouse and visual/state/text-scale matrices | Blocked by unavailable stack |
| Exact immutable image gate | Blocked by Docker |
| Protected staging, production, and rollback | Not run; requires protected access |

## Findings And Resolutions

1. Mobile Axe reported unsupported ARIA labels on generic rating and checkout
   step elements. Rating indicators now use `role="img"`; checkout indicators
   retain localized labels with valid semantics.
2. The returns icon link lacked an accessible name. It now uses the localized
   back-to-orders label.
3. Profile's seller CTA was inside a `tablist`. It now sits outside the tab
   collection.
4. Seller order rows nested action buttons inside a button-like row. Detail
   selection is now its own keyboard-accessible button.
5. Wallet history nested list items directly inside a list item. Each date
   section now contains a nested list for its payout rows.
6. The admin dashboard granularity select now has a localized accessible name.

## Residual Risks And Required Follow-Up

- Rerun the corrected browser accessibility suite when Docker and seeded
  services are restored.
- Run and review the Linux visual snapshots, state matrix, and 200% text-scale
  matrix against the production build.
- Capture fresh three-run mobile Lighthouse evidence and rerun the performance
  comparator.
- Build and test the committed exact frontend image, then obtain independent
  review and protected staging, production, and rollback evidence.

The candidate is locally healthy but remains release-blocked by these
environment-dependent gates.

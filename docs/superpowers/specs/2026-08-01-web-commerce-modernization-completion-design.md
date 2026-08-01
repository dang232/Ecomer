# Web Commerce Modernization Completion Design

**Status:** Approved by the user on 2026-08-01.

## Goal

Finish the VNShop web commerce modernization locally through a clean, tested,
committed release candidate. Preserve existing worktree changes and report
external staging or production actions separately when credentials or protected
approvals are required.

## Scope

- Complete the buyer account, order, return, notification, messaging, and
  seller-detail composition required by Plan 04.
- Resolve current frontend compiler failures and finish the Plan 07 old-
  generation cutover.
- Centralize E2E persona credentials and make the release result checker fail
  on selected skips, failures, and invalid result files.
- Run the local unit, type, lint, build, browser, accessibility, visual,
  bundle, Lighthouse, and exact-image gates that the repository can execute.
- Record truthful visual, performance, integrated, and release-candidate
  evidence and update the master progress table.

Production promotion, protected GitHub review, staging reconciliation, and
rollback dispatch are outside the local execution boundary. They remain
explicitly documented as external follow-up requirements.

## Architecture

The route and layout boundary remains `routes -> persona layout -> feature
public index -> shared`. Buyer account, orders, and returns get typed feature
presenters and public exports; existing top-level URLs remain unchanged.
Network, session, and browser-storage values remain `unknown` until decoded by
the existing Zod contracts. Server state remains in TanStack Query, navigable
state remains in the URL, and presentation logic remains in pure view models.

The release cutover removes preview and compatibility branches only after their
consumers are migrated. The final local gate builds the exact committed source
and checks that the image provenance identifies that source commit.

## Verification

Every behavior change follows a focused failing test, minimal implementation,
focused passing test, and then the broader repository gates. Completion requires
zero selected Playwright skips, a successful production build, passing
typecheck and lint, performance evidence within the recorded budgets, and a
clean reviewed commit. Any unavailable protected-environment gate is recorded
with its exact command and reason instead of being marked passed.

## Worktree Safety

The existing dirty worktree belongs to the user and must not be reset, cleaned,
or broadly staged. New commits include only reviewed files owned by the
modernization completion work. Generated scratch state stays ignored or is
removed only when its exact path is known and disposable.

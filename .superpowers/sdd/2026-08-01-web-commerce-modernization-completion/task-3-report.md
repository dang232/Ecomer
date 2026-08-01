# Task 3 Report - Make E2E Acceptance Deterministic And Fully Enforced

Date: 2026-08-01
Plan: `docs/superpowers/plans/2026-08-01-web-commerce-modernization-completion.md`
Task: `Task 3: Make E2E Acceptance Deterministic And Fully Enforced`

## Scope handled

- `fe/e2e` credential usage in the scoped legacy and modernization specs
- `fe/e2e/modernization/_credentials.ts`
- `fe/playwright.config.ts`
- `fe/scripts/assert-playwright-results.mjs`
- `fe/scripts/assert-playwright-results.test.mjs`
- `fe/scripts/check-e2e-credentials.mjs`
- `fe/scripts/check-e2e-credentials.test.mjs`
- `fe/scripts/check-release-workflows.test.mjs`

No application source, cutover deletion files, workflows, or performance scripts were modified.

## Red -> Green TDD trail

### Red

Ran from `fe` before edits:

1. `pnpm run lint:e2e-credentials`
2. `node --test scripts/check-e2e-credentials.test.mjs`

Observed failures:

- seeded credential references were still being detected across legacy E2E specs
- the credential checker was regex-based and over-reported comments/prose
- the checked-in suite audit test and CLI smoke test failed accordingly

## Implementation

### Credential policy

- Replaced the regex credential audit with a TypeScript AST audit.
- The checker now only flags credential misuse in:
  - login helper defaults
  - username/password field fills
  - `loginViaOidc(...)` calls
  - direct `/auth/login` payloads
- Comments, route paths, and other non-credential seeded references are no longer false positives.

### Centralized credential resolution

- Kept `fe/e2e/modernization/_credentials.ts` as the sole literal credential store.
- Made persona credential resolution lazy in contract mode so unselected personas do not fail resolution.
- Added strict `E2E_REQUIRED_PERSONAS` parsing and contract-mode inference from supplied persona env vars.
- Added eager `validateCredentials()` execution in `fe/playwright.config.ts`.

### E2E migration

- Removed remaining direct seeded login payloads from the scoped journey/day-simulation specs.
- Migrated those request-logins to `credentialForPersona(...)`-backed flows.
- Preserved route coverage and existing behavior.

### Result-policy hardening

- Rebuilt `assert-playwright-results.mjs` around Zod validation.
- The result checker now rejects:
  - malformed reports
  - zero-test reports
  - skipped tests
  - interrupted tests
  - unexpected outcomes
  - failed/timed-out tests
  - unknown statuses
  - duplicate titles within one project
  - test entries with no recorded results

### Workflow contract test fix

- Updated `check-release-workflows.test.mjs` to match the actual `@params` invocation shape in `promote.yml` while still asserting both `-ImageReference` and `-ExpectedSourceCommit` are present in the cutover gate invocation contract.

## Verification

Ran from `fe` after implementation:

1. `node --test scripts/check-release-workflows.test.mjs`
   - pass
2. `pnpm run lint:e2e-credentials`
   - pass
3. `node --test scripts/check-e2e-credentials.test.mjs scripts/assert-playwright-results.test.mjs`
   - pass
4. `pnpm run typecheck:e2e`
   - initial fail on `fe/e2e/modernization/cross-persona.spec.ts` due `string | undefined`
   - fixed
5. `pnpm run typecheck:e2e`
   - pass
6. `node --test scripts/check-release-workflows.test.mjs scripts/check-e2e-credentials.test.mjs scripts/assert-playwright-results.test.mjs`
   - pass
7. `git diff --check -- <scoped files>`
   - pass

## Outcome

Task 3 acceptance is satisfied locally:

- `pnpm run lint:e2e-credentials` passes
- `pnpm run typecheck:e2e` passes
- focused script tests pass
- modernization specs remain typed
- policy scripts are wired and validated

## Commit

Planned commit message:

`test(fe): enforce modernization acceptance journeys`

## Fix Round 1 - Review Findings Closed

Date: 2026-08-01

Reviewer findings addressed:

1. `assert-playwright-results.mjs` now enforces required persona coverage from either:
   - `E2E_REQUIRED_PERSONAS`, or
   - explicit CLI/config input via `--required-personas=...` / `validateReport(..., { requiredPersonas })`
2. `E2E_RELEASE_CONTRACT=true` now requires a non-empty explicit `E2E_REQUIRED_PERSONAS` declaration and no longer infers/defaults `buyer`.
3. The credential audit now rejects seeded email aliases as credentials outside `modernization/_credentials.ts`, in addition to seeded username literals.

Focused red -> green evidence:

- Red:
  - `node --test scripts/assert-playwright-results.test.mjs`
    - failed on missing `parseRequiredPersonas` and missing required-persona enforcement
  - `node --test scripts/check-e2e-credentials.test.mjs`
    - failed on missing seeded-email alias detection
    - failed because contract mode still allowed missing/blank `E2E_REQUIRED_PERSONAS`
- Green:
  - `node --test scripts/assert-playwright-results.test.mjs`
    - pass
  - `node --test scripts/check-e2e-credentials.test.mjs`
    - pass

Final focused verification from `fe`:

1. `pnpm run lint:e2e-credentials`
   - pass
2. `pnpm run typecheck:e2e`
   - pass
3. `node --test scripts/check-release-workflows.test.mjs scripts/check-e2e-credentials.test.mjs scripts/assert-playwright-results.test.mjs`
   - pass

Fix-round commit message:

`test(fe): enforce complete persona coverage`

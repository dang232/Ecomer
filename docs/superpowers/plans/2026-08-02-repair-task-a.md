# Repair Task A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local seeded `seller1` and `admin1` personas usable for password QA and prove a fresh buyer's seller application, admin approval, same-subject seller refresh, shop visibility, Seller Hub access, and duplicate-application prevention.

**Architecture:** Keep Keycloak's TOTP required-action definition available but remove it from the default local seeded users. Extend the existing idempotent Admin API bootstrap script with an explicit `KEYCLOAK_LOCAL_SEED_MFA_REQUIRED=true` opt-in that reconciles persistent seeded users in place. Verify the public gateway and SPA contracts with focused Playwright tests.

**Tech Stack:** Keycloak 26.6 realm JSON, Bash/kcadm bootstrap, Docker Compose local stack, React/Vite SPA, Playwright 1.60, Node test runner.

## Global Constraints

- The realm fixture must not force unsupported TOTP enrollment for local seeded QA users.
- The bootstrap/update path must repair already-persistent Keycloak users without wiping volumes.
- Preserve a clear opt-in path for environments that intentionally require MFA.
- Use the real gateway API/UI contracts.
- Do not bypass authorization in the frontend.
- Do not touch seller video files or video-related source/assets.
- Preserve unrelated pre-existing worktree changes and stage only files for this repair.
- The focused login regression must first fail with the observed HTTP 403 `CONFIGURE_TOTP` defect, then pass after the repair.
- The handoff test must prove: fresh buyer account -> seller application -> admin approval -> the same Keycloak subject refreshes to `SELLER` -> approved shop is visible -> `/seller` opens Seller Hub and `/seller/register` does not offer a second application.

---

### Task 1: Capture The Seeded Login Regression

**Files:**
- Create: `fe/e2e/repair-task-a-login.spec.ts`

**Interfaces:**
- Consumes: gateway `POST /auth/login` with `{ username, password }` and the seeded credentials resolved by `fe/e2e/modernization/_credentials.ts`.
- Produces: a focused Playwright regression test that asserts HTTP 200 and a non-empty `data.accessToken` for both `seller1` and `admin1`.

- [ ] **Step 1: Write the failing test first.**

  Add one serial Playwright test in `fe/e2e/repair-task-a-login.spec.ts`. Use the `request` fixture and `VITE_E2E_API_URL` (default `http://localhost:8080`), post `{ username, password }` for `credentialForPersona("seller")` and `credentialForPersona("admin")`, and assert each response is HTTP 200 with `body.data.accessToken` as a non-empty string. Do not use Keycloak's internal URL or the frontend auth implementation.

- [ ] **Step 2: Run the test against the current persistent stack and verify the expected red failure.**

  Run from `fe/`:

  ```powershell
  $env:E2E_SKIP_WEBSERVER='1'; $env:VITE_E2E_BASE_URL='http://localhost:3000'; pnpm exec playwright test e2e/repair-task-a-login.spec.ts --project=chromium
  ```

  Expected result before any infrastructure repair: the seeded `seller1` and/or `admin1` request fails with HTTP 403 and the response identifies `CONFIGURE_TOTP`.

- [ ] **Step 3: Commit only the regression test.**

  ```powershell
  git add fe/e2e/repair-task-a-login.spec.ts
  git commit -m "test: reproduce seeded keycloak totp login block"
  ```

### Task 2: Repair Local Seeded Keycloak Users Idempotently

**Files:**
- Modify: `infra/keycloak/vnshop-realm.json` user fixture entries for `seller1` and `admin1`.
- Modify: `infra/scripts/setup-keycloak-admin-client.sh` after Admin API authentication and before the final verification output.
- Modify: `.env.example` in the Keycloak admin/local configuration section.
- Create: `infra/scripts/keycloak-local-seed.test.mjs`.

**Interfaces:**
- Consumes: `KEYCLOAK_LOCAL_SEED_MFA_REQUIRED` with accepted values `true` and `false`; `KC_CONTAINER`, `KC_REALM`, and the existing Keycloak admin variables.
- Produces: an idempotent reconciliation of the users `seller1` and `admin1`, using `CONFIGURE_TOTP` only when `KEYCLOAK_LOCAL_SEED_MFA_REQUIRED=true`.

- [ ] **Step 1: Write failing fixture/bootstrap policy tests.**

  Add Node `node:test` coverage that parses `infra/keycloak/vnshop-realm.json` and asserts the two local QA users do not contain `CONFIGURE_TOTP` in `requiredActions`, while the realm-level `requiredActions` definition still contains an enabled `CONFIGURE_TOTP` provider with `defaultAction=false`. Read the bootstrap script as text and assert it documents and handles both `KEYCLOAK_LOCAL_SEED_MFA_REQUIRED=true` and the default repair path for both usernames. The test must fail against the current fixture/script because the fixture currently attaches the action and the script has no repair branch.

- [ ] **Step 2: Run the policy test and verify it fails for the intended reason.**

  Run from the repository root:

  ```powershell
  node --test infra/scripts/keycloak-local-seed.test.mjs
  ```

- [ ] **Step 3: Remove the required action from the two local fixture users.**

  Delete only the per-user `requiredActions` entries for `seller1` and `admin1`; retain the realm-level required-action provider and its disabled default-action setting.

- [ ] **Step 4: Add the persistent-user reconciliation to the existing bootstrap path.**

  After `kcadm config credentials` succeeds, validate `KEYCLOAK_LOCAL_SEED_MFA_REQUIRED` as `true` or `false`. Resolve each seeded username with the Keycloak Admin API. For an existing user, issue an idempotent `kcadm update "users/<id>" -r "${KC_REALM}"` that sets `requiredActions=["CONFIGURE_TOTP"]` when the flag is true and `requiredActions=[]` when false. Log whether each user was updated or absent. Keep the current client/role/mapper/identity-provider behavior intact and never remove a user or volume. Document the variable in the script and `.env.example`.

- [ ] **Step 5: Run the policy test green and repair the running persistent realm.**

  Run:

  ```powershell
  node --test infra/scripts/keycloak-local-seed.test.mjs
  $env:KEYCLOAK_LOCAL_SEED_MFA_REQUIRED='false'; bash infra/scripts/setup-keycloak-admin-client.sh
  ```

  Then rerun the Task 1 login regression. It must pass for both seeded personas without recreating Keycloak or deleting volumes. Run the opt-in command with `KEYCLOAK_LOCAL_SEED_MFA_REQUIRED=true` only as a controlled verification if the local stack can be restored to the default afterward; the checked-in tests must prove the branch without leaving the shared stack MFA-blocked.

- [ ] **Step 6: Commit the fixture/bootstrap repair.**

  ```powershell
  git add infra/keycloak/vnshop-realm.json infra/scripts/setup-keycloak-admin-client.sh infra/scripts/keycloak-local-seed.test.mjs .env.example
  git commit -m "fix: repair local keycloak qa persona login"
  ```

### Task 3: Prove The Applicant's Seller Handoff

**Files:**
- Create: `fe/e2e/repair-task-a-seller-handoff.spec.ts`

**Interfaces:**
- Consumes: gateway `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /sellers/register`, `GET /admin/sellers`, `POST /admin/sellers/{id}/approve`, and `GET /sellers`; SPA routes `/seller` and `/seller/register`.
- Produces: one sequential, unique-data Playwright journey asserting the complete applicant-to-seller handoff and the absence of a second application offer.

- [ ] **Step 1: Write the failing handoff journey against the current implementation.**

  Create a focused Playwright test using API request contexts for setup and browser pages for the UI assertions. Register a unique fresh buyer with a unique email and `Test1234!`, log in through `/auth/login`, capture the buyer JWT subject and refresh/CSRF cookies, submit `/sellers/register`, log in as seeded `admin1`, verify the application appears in `/admin/sellers`, approve the returned seller id, then call `/auth/refresh` in the original buyer request context with the CSRF header. Decode the JWT payload and assert the subject is unchanged and `realm_access.roles` includes `SELLER`. Assert the shop appears in the public `/sellers` response. Use a browser context carrying the buyer session to navigate to `/seller` and assert Seller Hub content is visible, then navigate to `/seller/register` and assert the application form/submit action is absent while the approved-shop state is visible. Use only public gateway paths and normal route guards.

- [ ] **Step 2: Run the focused journey and record the initial failure.**

  Run from `fe/`:

  ```powershell
  $env:E2E_SKIP_WEBSERVER='1'; $env:VITE_E2E_BASE_URL='http://localhost:3000'; pnpm exec playwright test e2e/repair-task-a-seller-handoff.spec.ts --project=chromium
  ```

  The test must fail before the infrastructure repair if seeded admin authentication is still blocked, and any subsequent failure must identify a real gateway/UI contract defect rather than an internal-service shortcut.

- [ ] **Step 3: Make only focused test adjustments required by the live contracts.**

  Keep the test serial and unique-data. Handle the gateway's standard API envelope and cookie/CSRF behavior explicitly. Do not add frontend bypasses, test-only role injection, direct database writes, direct Keycloak browser calls, or video interactions.

- [ ] **Step 4: Run the focused journey green.**

  Re-run the exact command from Step 2 and retain the Playwright result. The final run must prove every acceptance assertion in the same test.

- [ ] **Step 5: Commit the handoff test.**

  ```powershell
  git add fe/e2e/repair-task-a-seller-handoff.spec.ts
  git commit -m "test: prove seller applicant handoff"
  ```

### Final Verification

- [ ] Run `git diff --check` over the repair commits and inspect `git status --short` to confirm no video files or unrelated pre-existing edits were staged.
- [ ] Run `node --test infra/scripts/keycloak-local-seed.test.mjs`.
- [ ] Run the focused login and handoff Playwright tests together against the running gateway.
- [ ] Run the affected frontend typecheck or test command if the focused E2E changes expose compile issues.
- [ ] Report exact files changed, exact commands/results, the persistent-volume repair performed, and any remaining blocker such as unavailable external providers.

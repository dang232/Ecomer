# Repair Task A: Local QA Seller Handoff

**Date:** 2026-08-02

## Goal

Make the local seeded `seller1` and `admin1` personas usable for password-based QA and prove that a newly registered buyer can complete the seller application lifecycle through the real gateway and frontend.

## Design

The checked-in local realm fixture will keep the `CONFIGURE_TOTP` required-action provider available, but will not attach that required action to the seeded `seller1` or `admin1` users. The provider remains disabled as a default action, so environments can still choose MFA explicitly.

The existing `infra/scripts/setup-keycloak-admin-client.sh` bootstrap/update path will reconcile already-persistent local seeded users after authenticating to the Keycloak Admin API. By default it removes `CONFIGURE_TOTP` from those two users in place; with `KEYCLOAK_LOCAL_SEED_MFA_REQUIRED=true`, it assigns `CONFIGURE_TOTP` instead. The operation is idempotent and never deletes users, realms, databases, or volumes.

The focused login regression will call the gateway's `POST /auth/login` with `seller1` and `admin1`, asserting HTTP 200 and a non-empty access token. The seller-handoff E2E will create a unique buyer through `POST /auth/register`, authenticate that buyer and the seeded admin through the gateway, submit `POST /sellers/register`, approve the returned subject through the admin seller API, refresh the buyer session, and assert that the same JWT subject now has `SELLER`. It will then verify the approved shop through `GET /sellers` and exercise `/seller` plus `/seller/register` in the browser. The test will not bypass route guards, call internal service ports, or interact with video files.

## Error Handling And Compatibility

Missing seeded users are reported as a skipped reconciliation target so the bootstrap remains usable for realms that intentionally omit local fixtures. An invalid MFA flag is rejected rather than silently choosing a policy. The fixture and script defaults are local-QA friendly; production or intentionally MFA-enforced environments opt in through the documented variable.

## Verification

The red-green cycle will run the login regression against the current persistent stack before the repair and after the bootstrap repair. Script/fixture tests will cover the default and opt-in policies. The focused Playwright handoff will run sequentially against the gateway-backed SPA. Existing unrelated worktree edits will remain untouched, and no video paths will be changed.

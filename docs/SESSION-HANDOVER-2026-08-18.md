# Session Handover - Post-PR #314 Status

**Date:** 2026-08-19
**Branch:** `main`  
**HEAD:** `b5a84516`
**Latest merge:** PR #315 - trusted parcel metadata and shipping wiring

## Repository State

- Working tree contains the intentional trusted-parcel E2E and shipping wiring changes from this session.
- Docker is available locally (`29.7.2`).
- No production deployment should be promoted from the current manifests yet.
- This document supersedes the operational guidance in `HANDOFF.md`; May-July handovers and audit reports remain historical archives.

## Recently Completed

PR #314 and its commits from 2026-08-14 through 2026-08-17 added and verified in source:

- carrier recipient and address-code fields through checkout;
- parcel dimensions, declared value, and COD amount through the shipping protobuf contract;
- persisted shipping details for order recovery;
- carrier label persistence after creation;
- carrier cancellation routing and compensation-event topic provisioning;
- fail-closed behavior when carrier data is missing instead of synthetic tracking labels;
- order/shipping adapter and infrastructure test coverage for the new fields.

The earlier reliability closure also completed durable webhook acceptance, payment callback acknowledgement,
product/search repair, atomic cart merge, fail-closed inventory reservation, and notification retry state.
Do not reopen those areas as missing features without new failing evidence.

## Trusted Parcel Status

The trusted parcel metadata path is now covered end-to-end in the local stack. The shared E2E helper creates
and publishes a seller product with authoritative variant parcel dimensions, then all order-producing API
fixtures send only product, variant SKU, and quantity. No guessed parcel dimensions are added to
`POST /orders`.

The React checkout still fails closed when trusted parcel metadata is absent. With a trusted product/cart
fixture, the real browser checkout now completes successfully, including COD payment confirmation.

## Fresh Verification

- `npm run typecheck:e2e` - passed.
- `npm run lint -- --quiet` - passed.
- `npm run format:check` - passed.
- `node --test infra/scripts/e2e-day.contract.test.mjs` - 3/3 passed.
- `node infra/scripts/e2e-day.mjs` - 67/67 passed.
- Shipping Maven suite excluding the repository Pact fixture - 67 tests passed.
- `e2e/a11y.spec.ts` - 3/3 passed.
- `e2e/dark-mode-ui.spec.ts` - 2/2 passed after waiting for asynchronous storefront headings before sampling contrast.
- `e2e/flash-sale-ui.spec.ts` - 2/2 passed; empty campaigns now keep the section chrome and render the localized empty state.
- `e2e/home-page-ui.spec.ts` - 4/4 passed against the current storefront/footer contract.
- `e2e/messages-notifications-ui.spec.ts` - 3/3 passed against the Docker frontend.
- `e2e/seller-products-ui.spec.ts` - 4/4 passed, including the real MinIO image `PUT 200` upload.
- `e2e/seller-dashboard-ui.spec.ts` plus `e2e/admin-ui.spec.ts` - 7/7 passed.
- `e2e/checkout-ui.spec.ts` plus `e2e/specs/checkout.spec.ts` - 11/11 passed after restoring `payment-service` and `postgres-payment`.
- `git diff --check` - passed.

The bounded UI verification is green for the changed surfaces. The 41-test `e2e/full-ui-audit.spec.ts` run reached
22 passed tests before the command limit exposed legacy seller/admin tab locators. Those selectors now use the
current accessible `NavLink` contract, and the repaired seller/admin slices pass 15/15 with one worker:
`-g "Seller:"` (6/6) plus `-g "Admin:"` (9/9). The complete 41-test audit still needs a fresh bounded run before
it can be represented as a full-audit pass. The verification slices regenerate tracked screenshots under
`fe/e2e/evidence/audit/`; restore those generated artifacts before the final commit rather than treating them as
product changes.

## Next Engineering Sequence

1. Rerun the complete `full-ui-audit.spec.ts` in bounded batches and record the final count.
2. Verify admin dashboard migration, gateway authorization, refund ledger, report snapshot, and CSV behavior with Docker.
3. Close production manifest blockers: real image digests, SealedSecrets, public origins, provider modes, credentials, Kafka TLS/replication, and Elasticsearch security.
4. Start `docs/superpowers/plans/2026-08-08-admin-cursor-pagination.md`, beginning with shared cursor contracts and order/dispute reads.

## Deferred or External

- PayPal sandbox manual smoke requires sandbox credentials.
- SePay auto-confirm requires SePay credentials and is optional.
- VNPay remains deferred pending Vietnamese business registration and merchant onboarding.
- MoMo remains provider/onboarding-gated.
- GDT production submission requires a real endpoint, HSM-backed certificate, and token.

## Verification Commands

```powershell
cd services\shipping-service; .\mvnw.cmd test
cd ..\order-service; .\mvnw.cmd test
cd ..\..\fe; npm run verify
cd ..; node infra/scripts/e2e-day.mjs
cd fe; npx playwright test
```

Record fresh counts and failures in the next handover; do not copy historical counts into a release claim.

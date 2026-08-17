# Session Handover - Post-PR #314 Status

**Date:** 2026-08-18  
**Branch:** `main`  
**HEAD:** `1cd5495f`  
**Latest merge:** PR #314 - complete live-shipping checkout contract

## Repository State

- Working tree was clean when this handover was created.
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

## Immediate Blocker

The React checkout currently calls `trustedParcelDimensions()` in
`fe/src/app/pages/checkout/CheckoutPage.tsx`, which intentionally returns `null`. The page therefore
stops before `placeOrder` because product and cart responses do not expose authoritative parcel metadata.
The API harness can submit dimensions directly, but this does not prove that the real storefront checkout works.

The correct fix is not to restore a browser-side guessed parcel size. Add an authoritative product/variant
parcel-data contract, expose it through product/cart responses, carry it into checkout, and retain fail-closed
validation when the data is absent.

## Next Engineering Sequence

1. Define and implement trusted product/variant parcel metadata across product, cart, frontend contracts, and checkout.
2. Add browser and API tests proving dimensions, contact fields, amount fields, and carrier failure compensation.
3. Run the affected Maven suites, `npm run verify`, `node infra/scripts/e2e-day.mjs`, and Playwright.
4. Verify admin dashboard migration, gateway authorization, refund ledger, report snapshot, and CSV behavior with Docker.
5. Close production manifest blockers: real image digests, SealedSecrets, public origins, provider modes, credentials, Kafka TLS/replication, and Elasticsearch security.
6. Start `docs/superpowers/plans/2026-08-08-admin-cursor-pagination.md`, beginning with shared cursor contracts and order/dispute reads.

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

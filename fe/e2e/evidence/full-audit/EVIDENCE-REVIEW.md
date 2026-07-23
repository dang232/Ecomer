# Full-Stack Evidence Review

Generated: 2026-07-22

## Verdict

**LOCAL INTEGRATION: PASS**

**PRODUCTION PROMOTION: BLOCKED**

The Docker environment now passes the API and browser gates, but those gates
exercise local credentials, local provider modes, and deterministic stubs. A
green local run is not evidence that live carrier callbacks, live payment
providers, production secrets, or production network policy are ready.

## Final Evidence

| Gate                                |                                  Result | Source                                                          |
| ----------------------------------- | --------------------------------------: | --------------------------------------------------------------- |
| API day flow                        |                     66 passed, 0 failed | `node infra/scripts/e2e-day.mjs`                                |
| Full Playwright suite               |        202 passed, 2 skipped, 204 total | `cd fe; npx playwright test --reporter=line`                    |
| Business journey                    | 18/18 acceptance criteria, 6/6 chapters | [`../JOURNEY-REPORT.md`](../JOURNEY-REPORT.md)                  |
| Persona workdays                    |      Buyer 16/16; seller 8/8; admin 9/9 | `fe/e2e/evidence/{buyer,seller,admin}/REPORT.md`                |
| Frontend unit tests                 |                    598 passed, 88 files | `cd fe; npm run test -- --run`                                  |
| Frontend build                      |                                  Passed | `cd fe; npm run build`                                          |
| Product service targeted regression |                                  Passed | `ProductEventOutboxRelayTest`, `ProductServiceApplicationTests` |
| Search service tests                |                                  Passed | `services/search-service/.\mvnw.cmd -q test`                    |
| Agent Browser                       |  Guest, seller, admin evidence captured | [`AGENT-BROWSER-REVIEW.md`](AGENT-BROWSER-REVIEW.md)            |

The full Playwright run records two skips because some checks are fixture or
promotion-gate dependent. The skipped code paths are explicit in
`release-contract.spec.ts`, `ux-sweep.spec.ts`, `sellers-public-ui.spec.ts`,
and `workday-seller.spec.ts`; they must not be counted as live-provider proof.

## Independent Review Agent

The independent hard review was performed by the native review agent **Epicurus**
after the first evidence pass. The reviewer confirmed the following:

1. The original full-suite cart failure was a real timing/test-contract issue:
   the test waited for a transient notification instead of the durable cart
   write. It was not dismissed. Both affected buyer flows now await the POST
   `/cart/items` response and assert the persisted cart state.
2. The diagnostic pass captured local non-2xx traffic: `401 GET /orders`,
   `403 POST /auth/refresh`, `401 GET /users/me`, `404 GET /sellers/seller1`,
   and unauthenticated notification WebSocket attempts. No 5xx was captured in
   the final browser run, but the auth/CSRF/session behavior still needs a
   staging investigation.
3. Agent Browser coverage is intentionally narrower than Playwright. It proves
   representative rendered surfaces, not all authenticated mutations.
4. The local test environment uses stub shipping, disabled/sandbox payment
   providers, localhost URLs, and demo credentials. These are release blockers
   unless overridden by a production policy.

## Repository Fixes Proven by This Run

| Finding or risk                                                | Change                                                                                 | Regression evidence                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Product event JSON failed to reach search reliably             | Added typed Kafka consumer configuration and disabled producer type headers            | Journey AC-2.4 and search-service tests        |
| Product outbox migration collided with existing Flyway history | Moved the repair migration to V12 and kept the outbox entity/repository in persistence | Product service tests and API product creation |
| Product outbox `jsonb` insert failed at runtime                | Added Hibernate `@JdbcTypeCode(SqlTypes.JSON)` to the payload field                    | API day flow product-create step               |
| Slim product test context could not boot                       | Outbox adapter and relay now honor `spring.data.jpa.repositories.enabled`              | `ProductServiceApplicationTests`               |
| Buyer cart assertions depended on toast timing                 | Tests await the POST response and durable `/cart` state                                | Full Playwright: 202/204 passed                |
| Journey state writes were flaky on OneDrive                    | Added bounded retry for state/evidence writes                                          | Six-chapter journey: 18/18                     |
| Seller accept flow missed the confirmation dialog              | Test now submits the explicit `Confirm Order` action                                   | Seller fulfillment chapter                     |
| Review test treated pending moderation as public approval      | Test now asserts the backend publication state                                         | Buyer review chapter                           |
| Cart and auth notifications leaked hardcoded language          | Context uses i18n keys for login/cart/wishlist notifications                           | Vitest 598/598 and Playwright                  |

## Release Blockers and Gaps

### P0: Live carrier and payment contracts are unproven

- Compose and `.env.example` select `CARRIER_MODE=stub` by default. GHN/GHTK
  tokens, webhook secrets, and shop/partner identifiers are empty by default.
- COD/VietQR are the deterministic local paths. VNPay, MoMo, Stripe, and
  PayPal are disabled or sandbox-only in the local configuration.
- The webhook code has public routes, signature checks, durable acceptance, and
  retryable outbox delivery, but no live provider callback or provider contract
  test was run in this audit.
- Required before promotion: inject live secrets through the deployment secret
  manager, set explicit live modes, run signed callback/replay tests, and verify
  carrier-required address and parcel fields end to end.

### P1: Auth/session diagnostics need staging proof

The diagnostic flow records 401/403 responses and failed notification WebSocket
authentication in the local browser. The final test intentionally records these
instead of hiding them. Confirm cookie scope, CSRF token acquisition, refresh
rotation, WebSocket authentication, public origin, and gateway route policy in a
staging-like environment with TLS.

### P1: Local fallbacks must be policy-gated

The repository still contains intentional developer fallbacks documented in
[`Architech.md`](../../../../Architech.md) and
[`docs/PRODUCTION-READINESS-REVIEW.md`](../../../../docs/PRODUCTION-READINESS-REVIEW.md):

- configuration clients can fall back to local `application.yml` values;
- search can fall back from Elasticsearch to the JPA read model;
- inventory has a missing-projection local behavior that must fail closed for
  real stock;
- localhost endpoints and weak local credentials are present in Compose/env
  templates;
- social login is disabled by default;
- FX and provider modes have deterministic local fallback behavior;
- video processing uses local temporary staging and needs production tmpfs and
  durable object-storage policy.

Each fallback needs an environment guard, readiness policy, metric/log signal,
and production configuration test. Local behavior must never be selected merely
because configuration-service or an external provider is unavailable.

### P2: Fixture and projection boundaries

- The browser route is `/search`; `/products` is an API resource used by the
  journey setup. The inventory documents this distinction to avoid false route
  expectations.
- Seed/demo data is not a production data guarantee. New product events now
  project through Kafka/search in the journey, but old seed rows may require a
  replay/bootstrap job.
- The two skipped Playwright checks and all live-provider checks remain explicit
  release-gate work.

## Required Next Round

1. Run the same API/browser evidence suite against staging with TLS and no local
   default values.
2. Add signed GHN/GHTK webhook contract tests and a real outbox failure/retry
   observation test.
3. Enable one real payment provider in a sandbox/staging account and verify
   create, callback, reconciliation, refund, and idempotency paths.
4. Add a production configuration policy test that rejects `stub`, `demo`, empty
   secrets, localhost endpoints, and placeholder identities.
5. Resolve or explicitly accept the local auth/CSRF/WebSocket diagnostic errors
   before calling the release gate green.

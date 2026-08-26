# Handoff

> **Current status:** Read [`docs/SESSION-HANDOVER-2026-08-26-DEEP-FIX.md`](docs/SESSION-HANDOVER-2026-08-26-DEEP-FIX.md) first. This file remains a compatibility entry point and was refreshed for PR #320.

**Last updated:** 2026-08-26 (PR #320, HEAD `3e33684`)
**Read this first if you're picking up this codebase.** It replaces the need to walk all 29 SESSION-HANDOVER files for the common pickup case.

---

## Current Pickup

The latest deep-fix wave is PR #320. Trusted parcel metadata now travels from product variants through
cart, checkout, order, and shipping. The browser still fails closed when that authoritative data is absent.
Do not replace that guard with guessed browser values.

Production readiness remains blocked by external Kubernetes and provider evidence: real GHCR image publication
and digests, SealedSecret ciphertext, public origins, live provider credentials, broker/browser access, HA Kafka
with TLS and replication, and secured Elasticsearch. See `docs/PRODUCTION-READINESS-REVIEW.md`.

## What this codebase is

VNShop — multi-seller retail marketplace, polyglot microservices, portfolio project.

- **15 backend services** under `services/`. 13 Spring Boot 4.0.6 (Java 25) + 2 NestJS 11 (notification, messaging) + Spring Cloud Gateway (api-gateway).
- **React 18 + Vite SPA** under `fe/`. TanStack Query 5, React Router 7 (data routers), Zod 4, Tailwind 4, Zustand-installed-but-unused (uses Context + Query instead).
- **Per-service Postgres**, Kafka, Redis. Auth via Keycloak with httpOnly-cookie + in-memory access token (FE) and JWT bearer (BE).
- **Event-driven sagas** with outbox + dead-letter pattern in order-service.
- **Two regression suites:** `e2e-day.mjs` API harness and Playwright `fe/e2e/day-simulation.spec.ts` (15/15) — both run against the live stack.

Architecture details: `.sisyphus/ARCHITECTURE.md`. Per-service health: `.sisyphus/STATUS.md`.

---

## Current state (historical baseline)

```bash
# FE (historical baseline; rerun after PR #314)
cd fe && npm run typecheck   # 2 pre-existing errors (PayPal + checkout)
cd fe && npm test            # 156/156, 25 files
cd fe && npx playwright test e2e/day-simulation.spec.ts --project=chromium  # 15/15, ~27s

# BE (representative — full set is 12 services)
cd services/order-service   && ./mvnw -B test  # 104/104
cd services/payment-service && ./mvnw -B test  # 75/75
cd services/user-service    && ./mvnw -B test  # 116/116
```

**Live-stack verification of pt26 changes** (2026-05-21):
- order-service, payment-service, user-service rebuilt + restarted with the T1 (virtual threads) and T8 (`@HttpExchange`) commits live in their containers.
- All three booted cleanly under the new virtual-thread executor.
- day-simulation Playwright gate ran end-to-end against the fresh stack: **15/15 in 27s**, including the 5 IDOR negative-path tests that exercise the new `@HttpExchange` adapters under real HTTP traffic.
- This is the real verification gate for the runtime behavior — unit tests don't exercise virtual threads or the HTTP proxy wiring.

If any of these break on a fresh clone, the cause is almost always:
- **OneDrive reparse-points** (Windows) — run `node scripts/hydrate.mjs` to re-hydrate cloud-only stubs.
- **Stale containers** — `docker compose down -v && docker compose --profile apps up -d`.

---

## What shipped recently (pt12 → pt28 arc)

**18 authorization findings closed** + **3 cleanliness items** + **17 modern-feature commits** + **42 unit tests for branch coverage** + **15 day-simulation regression gates** + **i18n duplicate-key fix** + **lucide → Tabler icon migration (39 files)** + **dark-mode coverage sweep (47 files via codemod + theme tokens)** + **9 BE-vs-FE schema drift fixes (cart, user, order list+detail, checkout, review, seller-finance, admin, page)** + **cart-service env wiring + product-service variants[] adapter (9 unit tests)**.

Three thematic waves:

### Wave 1 — Security audit (pt12 → pt23)
End-to-end audit of every controller in 13 services against three anti-patterns:

1. **Authoritative wire fields** — DTO field the BE writes without re-deriving from JWT. (e.g. `buyerId` in request body)
2. **IDOR via missing JWT-vs-id cross-check** — endpoint mutates by id without verifying ownership.
3. **Path-mounted self-id** — `/users/{userId}/x` instead of `/users/me/x`.

**Findings ledger** (full table in `docs/AUDIT-SUMMARY-2026-05-21.md`):
- 5 high-severity (real money / refund / privilege escalation): payment amount tampering, seller self-credit, return-complete IDOR, image-activate IDOR, image avScanClean bypass, flash-sale buyerId impersonation
- 11 medium-severity (PII leak / cross-user write / IDOR)
- 2 low-severity

**The merge gate for new endpoints** (durable artifact):
1. Does the wire shape contain anything authoritative? Drop and resolve from JWT.
2. Does the use case look up another resource by id? Cross-check ownership at the use-case boundary.
3. Is there a "wrong-X → 403" test in `fe/e2e/day-simulation.spec.ts`?

### Wave 2 — Modern-feature utilization (pt26)
After the security work, two parallel reviewers (BE: Java 25 / Spring Boot 4 / NestJS 11; FE: React 18 / RR7 / TanStack 5 / Zod 4) found 14 places we were leaving features on the table.

Closed in 10 task commits (T1–T10):

| Task | What | Win |
|---|---|---|
| T1 | `spring.threads.virtual.enabled=true` on 11 servlet services + ReentrantLock fix | Eliminates thread-pool exhaustion under load |
| T2 | BuildKit cache mounts on 15 Dockerfiles | 60-80% cold-build speedup |
| T3 | Dedupe `usePageVisible` hook | Drift prevention |
| T4 | `z.enum` for status / method schemas | Closed-set type safety |
| T5 | Shared product mapper (use-products + use-search) | Fixes silent field drop |
| T6 | `queryOptions` builder migration | Type-safe cross-hook invalidation |
| T7 | `useSuspenseQuery` on 4 page routes | -100 lines of `isLoading`/`isError` boilerplate |
| T8 | `@HttpExchange` for 3 Java adapters | Declarative HTTP, less boilerplate |
| T9 | Branded Zod ids (`OrderId` / `ProductId` / `SellerId`) | Cross-domain id confusion → compile error |
| T10 | RR7 loaders for prefetch | Kills product → seller → reviews waterfall |

Per-task review found 1 Critical (ProductPage migration mid-bail) + 1 Important (`enabled` vestige regression) + 6 Minor; all fixed.

### Wave 3 — i18n / icons / dark mode / BE-shape alignment (pt27 → pt28)
The largest UX correctness pass since pt12.

| Block | What | Win |
|---|---|---|
| pt27 i18n | Duplicate top-level `home` key in `vi.json`/`en.json` was wiping the entire `home.*` namespace at parse time | Hero, greeting, signIn, tabs all render localized strings instead of raw keys |
| pt27 icons | 39 files / ~50 unique icons migrated from `lucide-react@0.487` to `@tabler/icons-react@3.34` via `fe/scripts/migrate-icons.mjs` codemod; emojis on tabs/banners/login replaced with proper Tabler icons | Cohesive visual language; `lucide-react` removed from package.json |
| pt28 theme | `theme.css` token contract documented; dark palette gets 3-step elevation (`--background` `#0b0e14` < `--card` `#151924` < `--surface-elevated` `#1d2230`) | Cards no longer invisible against body in dark mode |
| pt28 dark sweep | `fe/scripts/migrate-dark-tokens.mjs` codemod rewrote 47 files / 678 swaps; HomePage, Root, LoginPage, RegisterPage, PasswordResetPage, AdminPage, SellerPage, etc. all use `bg-card` / `text-foreground` / `text-muted-foreground` / `border-border` | Dark mode is actually dark across every page |
| pt28 schemas | 9 Zod schemas aligned with actual BE DTOs via `transform()` aliasing — cart, user, order (list + detail), checkout calc, shipping options, review, wallet, payout, admin sellers/disputes/payouts/coupons, dashboard summary, page (Spring `number` vs user-service `page`) | Page-wide error fallbacks fixed on `/cart`, `/profile`, `/orders`, `/checkout`, admin/seller dashboards |
| pt28 cart wiring | Added `PRODUCT_SERVICE_URL` to cart-service compose entry + rewrote `ProductHttpClientAdapter` to read price from `variants[0].priceAmount` and image from sortOrder-sorted `images[]` | Cart items show real names + prices instead of UUIDs and 0₫. 9 new unit tests lock it in |
| pt28 seller orders | `/seller/orders/pending` returns `List<OrderResponse>`, FE flattens at the endpoint adapter into the `PendingSubOrder[]` shape SellerOrders expects | Seller pending queue renders again |

---

## Historical Notes

The following notes are retained from the May handoff for historical context. They are not the current backlog:

1. **PayPal capture round-trip.** Last unproven payment path. Manual browser test, must run while logged in as the buyer who owns the payment. Cannot be automated within this session.
2. **Shipping tracking ownership check.** `GET /shipping/tracking/{code}` lets any authenticated user read any tracking code. Deferred in pt22 because: (a) tracking codes are carrier-opaque, not enumerable; (b) fix needs cross-service architecture work (shipping has no orderId/buyerId mapping); (c) GHN/GHTK/USPS/FedEx all expose tracking by code alone — pinning ours would be stricter than industry.
3. **VNPay/MoMo redirectUrl is missing from `PaymentResponse`.** FE does `window.location.href = init.redirectUrl` after `POST /payment/vnpay/create`, but the BE response only carries `paymentId / orderId / buyerId / amount / method / status / transactionRef / createdAt` — no `redirectUrl`. So checkout currently redirects to `undefined`. Needs product-side direction: BE generates the gateway redirect server-side, or FE constructs it from sandbox config? See pt28 gotcha #62.

Don't reverse #1 or #2 without new product-side direction.

---

## Operational gotchas (memory)

The `~/.claude/projects/.../memory/` directory persists context across sessions. Live entries:

- **`feedback_post_agent_quality_pass`** — after every sub-agent merges, do clean-code / DDD / DRY / SOLID review and fix violations.
- **`feedback_session_handover_md`** — refresh `docs/SESSION-HANDOVER-*.md` at end of every session.
- **`feedback_detect_silent_bail`** — sub-agents bail mid-task and pass off narration as completion. Verify diff before trusting report.
- **`feedback_worktree_base_ref_divergence`** — agent worktrees may be based on `origin/main`; if local diverged, correct-looking agent work can silently delete recent commits on merge.
- **`feedback_split_long_agent_runs`** — long Opus sub-agent runs hit Cloudflare 524s; split into smaller parallel Sonnet agents.
- **`feedback_onedrive_reparse_point_gotcha`** — OneDrive cloud-stubs silently break Playwright discovery and Docker builds. Detect via PowerShell `Mode -a---l`, hydrate via `node scripts/hydrate.mjs`.
- **`feedback_virtual_thread_pinning_synchronized`** — when virtual threads are on, `synchronized` + blocking I/O pins the carrier thread. Use `ReentrantLock` instead.
- **`feedback_git_checkout_scope_creep`** — `git checkout -- <dir>` discards every unstaged change under that path, not just the codemod's. `git status -- <dir>` first or use selective stash. (pt27 — got bitten twice in one session)

In-handover gotchas (numbered #40–53 across pt15–pt26): see the per-block files for full text. Highlights:

- **#41** — wire-field-never-populated is the hardest hole to spot. Any DTO field the FE doesn't send is either dead or a security boundary the BE trusts blindly.
- **#46** — vulnerabilities at the intersection of two anti-patterns hide longest. Image-activate had IDOR + avScanClean bypass at the same site; each looked benign alone.
- **#48** — "all endpoints unauthenticated" on a per-service config is a false alarm when the gateway is the auth boundary. Always check `services/api-gateway/.../SecurityConfig.java` permitAll matchers + `RouteConfig.java` route definitions before flagging.
- **#49** — Spring's JSON binding silently drops unknown wire fields. The audit signal isn't "the BE rejects the field" — it's "the BE doesn't *use* the field."
- **#51** — self-review is theater. Always dispatch an independent code-reviewer subagent for post-agent quality passes; the same agent that wrote the code carries the same blind spots into review.
- **#52** — `useSuspenseQuery` cannot be conditionally enabled, but `*Options` factories shared with plain `useQuery` callers still need `enabled: !!id`. The Suspense path passes a defined id from URL params, so the gate is a no-op there; the non-Suspense callers need it.
- **#54** — `git checkout -- <dir>` discards every unstaged change under that dir, not just the codemod's. (memory above + pt27 doc)
- **#55** — codemod-only sweeps miss inline `style={{ background: ... }}`. After a Tailwind-only codemod, immediately grep for them and audit. (pt28)
- **#56** — schema test fixtures must be derived from BE responses, not hand-rolled to match FE expectations. Stale fixtures hide drift. (pt28)
- **#58** — Zod parse failures want a `transform()` aliasing both shapes, NOT a `.passthrough()` shortcut. The latter buries drift until a downstream consumer crashes. (pt28)
- **#59** — silent offline-mode branches in BE adapters need loud failure modes. cart-service's missing `PRODUCT_SERVICE_URL` produced UUID-named 0₫ items in production with zero log noise. (pt28)
- **#60** — order-service has no order-level `status` field; FE must derive it from `subOrders[].fulfillmentStatus + paymentStatus`. (pt28)
- **#61** — drift clusters. After fixing one schema, audit ALL of them. The pt28 audit turned up 8 more after `cart`. (pt28)
- **#62** — VNPay/MoMo `PaymentResponse` has no `redirectUrl` field. Missing BE functionality, not schema drift. (pt28)
- **#63** — `/orders` list and `/orders/{id}` are different shapes; the same Zod schema can absorb both via a transform that handles three status cases (already-UI / raw-enum / derive-from-sub-orders). (pt28)
- **#64** — `/seller/orders/pending` returns nested orders; flatten at the endpoint adapter to keep the page contract stable. (pt28)
- **#65** — Spring `Page<T>` uses `number` for page index; user-service `PublicSellersPageResponse` uses `page`. Accept both. (pt28)

---

## Repository map

```
.
├── HANDOFF.md                   # this file
├── README.md                    # project overview, architecture diagrams
├── docker-compose.yml           # 16 services, two profiles: apps + legacy
├── docs/
│   ├── AUDIT-SUMMARY-2026-05-21.md     # consolidated security audit ledger (pt12 → pt23)
│   ├── E2E-AUDIT-2026-05-18.md         # what e2e-day.mjs covers
│   ├── STATUS-REALITY-2026-05-14.md    # gap-analysis reconciliation
│   └── SESSION-HANDOVER-*.md           # 27 per-session blow-by-blow files
├── fe/                          # React 18 SPA, Vite, TanStack Query 5
│   ├── e2e/day-simulation.spec.ts      # 15 regression-gate tests
│   └── src/app/
│       ├── hooks/use-*.ts              # one file per feature, *Options + use* exports
│       ├── lib/api/                    # endpoints + product-mapper + query-client
│       ├── pages/                      # route-level components
│       ├── routes.ts                   # RR7 createBrowserRouter with loaders + Suspense
│       └── types/api/                  # Zod schemas + branded ids
├── infra/
│   ├── compose/staging/                # staging compose overlay
│   ├── k8s/                            # base + dev/staging/prod overlays
│   ├── keycloak/vnshop-realm.json      # seeded buyer1, seller1, admin1
│   └── migration-policy.md
├── scripts/
│   └── hydrate.mjs                     # OneDrive reparse-point hydrator (Windows)
└── services/
    ├── api-gateway/                    # Spring Cloud Gateway, Reactor — virtual threads NOT applied
    ├── order-service/                  # 104 tests, the densest domain logic
    ├── payment-service/                # 75 tests, multi-gateway (VNPay/MoMo/PayPal/Stripe/COD)
    ├── notification-service/           # NestJS, 36 tests
    ├── messaging-service/              # NestJS + WebSocket, subscriber-only design
    └── ... (10 more)
```

---

## How to Resume Work

### Current priorities
- Implement trusted parcel metadata across product/cart/checkout.
- Run fresh shipping, order, frontend, API E2E, and Playwright verification.
- Complete admin dashboard runtime evidence with Docker.
- Close Kubernetes production-contract blockers.
- Start the August admin cursor-pagination plan after release blockers are addressed.

### Historical options
- **PayPal capture** — start a browser session, log in as the buyer who placed an unconfirmed PayPal order, walk the sandbox, confirm the capture lands in `payment_status`.
- **Observability** — distributed tracing on the new virtual-thread executor, request-id propagation through `@HttpExchange` interfaces, structured logging conventions across services.
- **CI hardening** — matrix `mvnw verify` on every PR, profile-aware compose-up smoke test, automated docker rebuild + day-simulation gate.
- **New feature** — point me at a spec or describe what should exist; the codebase has clean idioms for adding a controller (Spring) or page (React).

### Follow the durable conventions

**New BE endpoint?** Walk the three security questions above. Add a "wrong-X → 403" test to `fe/e2e/day-simulation.spec.ts`.

**New FE query?** Define the `*Options` factory in the relevant `use-*.ts` hook. Use `useSuspenseQuery` for primary route data behind a Suspense boundary; `useQuery` for secondary panels. Reference the queryKey by `*Options.queryKey` for invalidations — never as a string array literal.

**New domain id?** Add a brand to `fe/src/app/types/api/branded-ids.ts` if the id is non-opaque to the FE and crosses domain boundaries. Skip for opaque tokens (idempotency keys, transaction refs).

**New Java service or controller?** Follow the order-service shape: hexagonal layout (`application/`, `domain/`, `infrastructure/`), `JwtPrincipalUtil.currentUserId()` at the controller boundary, port interface + adapter for outbound calls, declarative `@HttpExchange` interface for HTTP outbound.

### Don't fight the tools

- Run sub-agent reviews **independently** of the agent that wrote the code. Self-review misses the same blind spots.
- Use `node scripts/hydrate.mjs` before any Docker rebuild on Windows.
- The skill at `superpowers:subagent-driven-development` is the canonical executor flow when working from a plan: implementer → spec review → quality review → next.
- Don't dispatch multiple implementer subagents in parallel — they conflict on commits. Reviewers in parallel are safe.

---

## Where to look for what

| Question | File |
|---|---|
| What does the codebase do? | `README.md`, `.sisyphus/ARCHITECTURE.md` |
| What is each service's status? | `.sisyphus/STATUS.md` |
| What's the security audit ledger? | `docs/AUDIT-SUMMARY-2026-05-21.md` |
| What did session pt-N do? | `docs/SESSION-HANDOVER-2026-05-{17..21}-pt{2..26}.md` |
| What does `e2e-day.mjs` cover? | `docs/E2E-AUDIT-2026-05-18.md` |
| Reconcile old gap-analysis with reality | `docs/STATUS-REALITY-2026-05-14.md` |
| FE app setup | `fe/README.md` |
| How are infra concerns organized? | `infra/migration-policy.md`, `infra/service-split-assessment.md` |

For day-to-day work, **HANDOFF.md (this file) + AUDIT-SUMMARY + the latest pt-N handover** is enough. The earlier per-session files are archive material.

# Issues - vnshop-deep-fix

- ## [2026-08-25T21:10:00+07:00] Task: 8 verification limitation
  - The target worktree contains unrelated pre-existing order-service compilation failures in DLT, config logging, outbox accessors, and projection entities. The focused order Maven command cannot reach `IdempotencyFilterTest` until those baseline failures are repaired.
  - Payment-focused SePay and payment-processing tests compile and pass; full payment-service regression remains separate from the task-specific evidence.

- ## [2026-08-25T21:25:00+07:00] Task: 8 adversarial verification verdict
  - Targeted `IdempotencyFilterTest` and payment/SePay tests pass with `services/*/mvnw.cmd`; the exact `bash -lc 'set -o pipefail; ...'` wrapper cannot execute because WSL reports `/bin/bash` missing. Evidence logs are `.omo/evidence/vnshop-deep-fix/task-8-idempotency-rerun.log` and `task-8-payment-rerun.log`.
  - HIGH: SePay `SepayTransactionValidator` rejects every overpayment (`actual > payment.amount()`) even when `overpayment-policy=HOLD`; the configured HOLD policy has no hold/reconciliation path, so the required overpayment hold behavior is not implemented.
  - HIGH: SePay callback/poller idempotency is not shared or atomically claimed. Webhook uses `PaymentCallbackLogStore` lookup-then-save while poller calls promotion directly with a random callback id; duplicate callback races can create duplicate callback/outbox attempts even though payment row locking prevents a second completion.
  - HIGH: `PaymentPromotionService` only special-cases COMPLETED and can promote other terminal states (FAILED/PAYMENT_TIMEOUT/REFUNDED) to COMPLETED; SePay callers only reject non-PENDING before the call, leaving other promotion callers exposed.
  - MEDIUM: Poller returns on the first malformed/unmatched/invalid transaction and leaves cursor unchanged, so one permanent bad transaction blocks later valid credits. Existing tests cover only unmatched memo, not invalid financial payloads.
  - MEDIUM: `IdempotencyConfig` registers body-caching servlet URLs as `/orders/*` and `/checkout/*`, while MVC interceptor scope is `/orders/**` and `/checkout/**`; nested routes can be intercepted without the body wrapper, causing body hashing to consume the request stream before controller binding.
  - MEDIUM: `RedisConfig` defines an unqualified `StringRedisTemplate` bean while Spring Boot also auto-configures one; the filter constructor injects by type, so full application startup may fail with ambiguous beans. No context test proves wiring.
  - MEDIUM: Payment idempotency claim SQL allows `payment_id` to be null for in-progress claims, but `PaymentIdempotencyKeyJpaEntity` still maps it `nullable=false` and does not map claim status/lease columns; the lease/reclaim contract is not represented by the entity.
- LOW: SePay webhook canonical payload now includes currency/direction, but callback duplicate lookup semantics were not shown to require payload-hash equality for the same provider/event/signature; changed payloads may be treated as duplicates.

- ## [2026-08-25] Task: 28 verification limitations
  - The requested `problems.md` was absent at task start; it was created append-only with the task-specific blocker summary.
  - Docker Desktop reports a running engine, but no authenticated Kafka/PostgreSQL/Redis reliability fixture was started locally; live duplicate-delivery and malformed-DLT claims are intentionally BLOCKED_EXTERNAL.
  - Git Bash does not provide `flock`; `backup-cron.sh` exits 127 with a WSL/Linux remediation message rather than silently permitting overlap. The Linux `flock -n` path is syntax-validated but not runtime-proven here.
 - Scope note: repository-wide diff is 350 files / +5005/-10362 lines, far beyond task 8; task-8 touched-file review was kept bounded and no unrelated files were modified.

- ## [2026-08-25] Task: 18 verification limitations
  - Live Prometheus query and `promtool test rules` could not be proven because Docker/Prometheus tooling was unavailable in this Windows session; static rule/dashboard tests and service compilation were used instead.
  - Repository LSP diagnostics timed out at the daemon, so compiler and focused test output are the source-level verification fallback.
- ## [2026-08-25T21:45:00+07:00] Task: 8 follow-up verification
  - Full repository order-service Maven remains blocked by unrelated pre-existing compilation failures; focused `IdempotencyFilterTest` passes via `services/order-service/mvnw.cmd`.
  - Focused payment tests `SepayTransactionValidatorTest`, `SepayWebhookPollerParityTest`, and `SepayPollerTest` pass via `services/payment-service/mvnw.cmd`; the exact bash wrapper is unavailable on this Windows host.
   - `ast-grep` MCP search was unavailable because `@ast-grep/napi` is not installed; no rewrite was needed. `git diff --check` and service-local compile checks pass.

   - ## [2026-08-25] Task: 32 verification limitations
     - CodeGraph was unavailable because the PR worktree has no `.codegraph/` index. The required ast-grep scan was attempted but unavailable because `@ast-grep/napi` is not installed; equivalent scoped `rg` scans found no production raw `<img>`, `Image.network`, or `NetworkImage` bypasses.
     - FE typecheck, build, focused image/gallery tests (23/23), formatting check, Flutter analyze, and full Flutter tests (193 passed) passed. Full FE Vitest had 1058 passing tests and 3 unrelated pre-existing failures in app-config and video-upload expectations.
     - Playwright MCP had no usable navigation capability. `localhost:5173`, `localhost:3000`, and `images.vnshop.com` were unreachable, so browser screenshots and live `curl -I` cache-header proof were blocked; no live CDN claim is made.

- ## [2026-08-25T22:30:00+07:00] Task: 19 - verification limitations
      - Live gateway probes still target an already-running pre-change process; do not interpret its 401/503 responses as evidence against the worktree implementation. Docker restart/rebuild was not performed.
  - `buf lint` passes, but `buf breaking --against .git#branch=main` remains unavailable in this dirty worktree and `buf generate` remains blocked by the configured remote plugin rejecting its `paths` option.
  - Flutter analysis is now available and passes on this Windows host after dependency resolution; no Developer Mode blocker occurred in the final run.
      - The requested ast-grep MCP structural scan was unavailable because `@ast-grep/napi` is not installed; targeted repository searches were used instead and no 301 redirect implementation was found.

- ## [2026-08-25T23:40:00+07:00] Task: 29 verification limitations
  - Playwright navigation to `http://localhost:5173` was blocked with `ERR_CONNECTION_REFUSED`; no browser/runtime visual claim is made. Flutter widget tests supplied the available UI proof.
  - Configuration-service Jest could not run because its local `jest` executable/dependencies are unavailable in this worktree. TypeScript FE app/test typechecks passed, and payment-service Maven coverage passed.
  - The requested ast-grep structural scan was unavailable because `@ast-grep/napi` is not installed; equivalent scoped searches found no scoped `PlaceholderPage`, guest checkout identity, or VietQR placeholder bank/account literals in production mobile code.
  - The worktree contains unrelated pre-existing changes from other tasks; review was bounded to task-29 files and no unrelated changes were reverted.

    - ## [2026-08-25] Task: 22 verification limitations
      - CodeGraph is unavailable in the PR worktree because it has no `.codegraph/` index; scoped `rg` scans were used instead.
      - Redis-backed expiry and cross-replica single-flight were not live-proven because no authenticated Redis runtime was available. The unit test proves same-JVM loader coalescing only.
      - k6 is not installed on this Windows host; the new Node probes parse successfully but live gateway execution is runtime-gated.
      - Existing order-service test compilation remains blocked by the unrelated `ApiExceptionHandlerTest` `ProblemDetails`/`ApiResponse` type mismatch.

- ## [2026-08-25] Task: 20 - verification limitations
  - The PR worktree was not codegraph-indexed and TypeScript LSP was unavailable. ast-grep was not available in the environment; scoped static scans were used.
  - Live Docker/curl probes were not run. The repository contains broad unrelated changes, so task-owned files were tracked explicitly rather than treating the full worktree diff as task scope.
  - Remaining risk: duplicate Spring `ApiExceptionHandler`/`GlobalExceptionHandler` and security-generated auth/rate-limit responses require a later integrated runtime contract pass; deprecated `errorCode` expiry is documented but not dynamically enforced.

- ## [2026-08-25] Task: 20 continuation verification limitations
  - Docker compose could not start because required `VNSHOP_SEARCH_CURSOR_SECRET` was unset; exact pipefail curl runtime probes were therefore blocked.
  - Product-service compile remains blocked by pre-existing `CacheConfig` missing `Cache` type and missing OpenTelemetry dependency. Order full test execution also encountered protobuf temporary-directory cleanup; focused handler test passed.
  - CodeGraph, ast-grep, and TypeScript LSP remain unavailable in this PR worktree/environment.

- ## [2026-08-26T00:06:49.4942796+07:00] Task: 30 verification limitations
  - ast-grep runtime was unavailable; equivalent rg scans were used.
  - TypeScript LSP is not installed and Playwright/live FE runtime was unavailable; no live browser claim.
   - Full FE source still contains unrelated hardcoded English aria-labels outside the requested checkout scope.

 - ## [2026-08-26] Task: 31 verification limitations
  - The required Playwright a11y suite was attempted, but the app/gateway runtime was unavailable and the run timed out before usable page evidence; no live Axe pass is claimed.
   - TypeScript LSP and ast-grep remain unavailable in this host; scoped Vitest, token static checks, and compiler/build checks were used instead.

- ## [2026-08-26] Task: infrastructure F2/F4 repair verification
  - External GHCR digest resolution was not asserted because the chosen non-zero digests are deterministic repository test fixtures; image syntax and zero-fixture rejection passed with `SKIP_CRANE=true`.
  - No live authenticated Kafka broker was used; canonical generation/check and static consumer usage scan passed.
  - JSON LSP diagnostics were unavailable because Biome is not installed and installation was previously declined.


 - ## [2026-08-26T01:09:40.9280984+07:00] F1/F4 tooling repair limitations
  - lsp_diagnostics could not run because the TypeScript LSP is not installed and installation was previously declined; node --check and actual Node execution were used instead.
  - F4 emitted pre-existing Git CRLF normalization warnings while reading the dirty worktree diff; the scope predicates still returned PASS.
   - Scope PASS is limited to the implemented deterministic predicates. It does not clear the independent all-zero production image digests, absent real external secret material, runtime availability, or task-level focused blockers.

- ## [2026-08-26] Task: F2 repair wave
  - TypeScript and Java LSP diagnostics were unavailable or timed out; compiler, ESLint, focused tests, and clean Maven builds supplied the fallback.
  - Maven protobuf generation intermittently hit Windows file-lock cleanup failures during rapid target reuse; clean serial reruns succeeded for payment, order, product, and gateway compiles.
  - Missing Pact fixtures, no root Maven reactor POM, absent quality verifier script, and production secret/image/ACL blockers remain baseline or external.

   - ## [2026-08-26T01:10:40.3020074+07:00] Final F1/F4 verification outputs
     - Scope verifier emitted pre-existing CRLF normalization warnings from unrelated files while invoking git diff; its deterministic checks returned PASS and scoped git diff --check returned 0.

 - ## [2026-08-26] F3 contract-repair verification limitations
   - The exact order-service `BrokerFailureDltReplayTest` selector now resolves, but Maven cannot compile the worktree because `UseCaseConfig.java:130-132` references an unavailable `Bulkhead` symbol. No live broker/DLT claim is made.
   - The requested FE Playwright grep still returns no tests because `fe/e2e/checkout-ui.spec.ts` contains only empty-cart, missing-address, and four-step render tests. Mocked Vitest contracts cover COD, intentional SePay exclusion, and one-order payment retry instead.
   - `flutter test test/features/checkout` passes 35 tests, while `flutter analyze` reports pre-existing `checkout_repository_impl.dart` diagnostics. No Flutter production code was changed.

 - ## [2026-08-26] F3 Flutter analyzer limitation superseded
   - The earlier analyzer limitation is closed in the current worktree. `checkout_repository_impl.dart` has no unused-import or `Future.toSet` diagnostic; full analyzer exit 0 and all checkout tests pass. The older limitation entry remains unchanged as historical evidence.

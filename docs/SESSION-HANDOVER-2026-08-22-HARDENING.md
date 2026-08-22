# Session Handover - Security and Reliability Hardening

**Date:** 2026-08-22
**Branch:** `hardening/full-worktree-2026-08-22`
**Execution state:** Preparing a draft PR with the full meaningful worktree
**Important:** The shared worktree contains substantial pre-existing and concurrent changes. Do not treat the complete working-tree diff as belonging to this hardening session.

## Purpose

This session began as a repository-wide endpoint, frontend, observability, utility, and security audit. It then fixed the notification/Kafka integration blocker, produced a tracked hardening design and plan, and implemented several application, observability, Compose, and Kubernetes hardening changes.

The implementation is **not fully complete**. Application-security fixes and several infrastructure lanes are verified. Java-to-Java/Nest transport trace propagation has partial edits in the worktree but has not received a complete final verification or independent review.

## Tracking documents

- Design: `docs/superpowers/specs/2026-08-22-vnshop-hardening-design.md`
- Execution plan: `docs/superpowers/plans/2026-08-22-vnshop-hardening.md`

The selected policy is **secure base Compose plus an explicit opt-in development configuration**.

## Completed and verified

### 1. Kafka and notification-service startup repair

Files:

- `.env.example`
- `docker-compose.yml`
- `infra/kafka/kafka_server_jaas.conf.template`

Changes:

- Kafka readiness now probes the client-facing SASL listener on `9092`, not the controller listener on `9093`.
- Added the missing `svc-notification` JAAS principal and credential substitution.
- Documented `KAFKA_SVC_NOTIFICATION_PASSWORD`.

Root causes confirmed at runtime:

1. Compose declared Kafka healthy while `9092` was not yet accepting client connections.
2. The broker did not define the `svc-notification` principal used by notification-service.

Evidence:

- Kafka healthy.
- Notification service healthy.
- Notification Kafka consumer joined its consumer group.
- `GET /health` on notification-service returned `200 {"status":"ok"}` before secure-base ports were applied.
- API gate passed: `67 passed, 0 failed`.

### 2. Cart identity authorization

Primary files:

- `services/cart-service/src/cart/infrastructure/cart.controller.ts`
- `services/cart-service/src/cart/infrastructure/auth/`
- `services/cart-service/src/cart/cart.module.ts`
- `services/cart-service/src/cart/infrastructure/cart.controller.spec.ts`
- `services/cart-service/test/app.e2e-spec.ts`
- `services/cart-service/package.json`
- `services/cart-service/package-lock.json`

Changes:

- Added direct JWT/JWKS validation in cart-service.
- Added a NestJS JWT guard to cart routes.
- Cart user identity now comes from validated `req.user.sub`.
- Caller-supplied `x-user-id` is no longer an authentication source.

Evidence:

- Red regression: spoofed `x-user-id` without a validated principal was accepted before the fix.
- Focused controller tests passed after the fix.
- Full cart unit suite: `9 suites`, `58 tests passed` at the application-security checkpoint.
- A later tracing change increased the cart suite to `59/59 passed`.
- TypeScript compilation and cart build passed.

### 3. Invoice ownership authorization

Primary files:

- `services/invoice-service/src/main/java/com/vnshop/invoiceservice/application/InvoiceService.java`
- `services/invoice-service/src/main/java/com/vnshop/invoiceservice/domain/entity/Invoice.java`
- `services/invoice-service/src/main/java/com/vnshop/invoiceservice/infrastructure/event/OrderConfirmedListener.java`
- `services/invoice-service/src/main/java/com/vnshop/invoiceservice/infrastructure/web/InvoiceController.java`
- `services/invoice-service/src/main/resources/db/migration/V2__invoice_buyer_ownership.sql`
- `services/invoice-service/src/test/java/com/vnshop/invoiceservice/InvoiceControllerTest.java`

Changes:

- Persisted invoice `buyerId` from `order.confirmed`.
- Invoice reads and GDT status now require the owning buyer, owning seller, or admin.
- Seller listing requires the requested seller ID to match the authenticated seller unless admin.
- XML generation, GDT submission, and resubmission remain admin-only.

Evidence:

- New tests demonstrated seller-to-seller access returned `200` before the fix.
- Focused controller tests: `6 tests`, `0 failures`.
- Invoice-service suite: `7 tests`, `0 failures`.

### 4. PayPal chargeback webhook verification

Primary files:

- `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/paypal/PayPalWebhookVerifier.java`
- `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/paypal/DefaultPayPalWebhookVerifier.java`
- `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/paypal/PayPalWebhookHeaders.java`
- `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/web/PayPalChargebackWebhookController.java`
- `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/config/SecurityConfig.java`
- `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/config/UseCaseConfig.java`
- PayPal verifier/controller tests under `services/payment-service/src/test/`

Changes:

- Added PayPal Verify Webhook Signature API integration.
- Verification uses the five required PayPal transmission headers, configured webhook ID, and received event JSON.
- Only `verification_status: SUCCESS` is accepted.
- Verification runs before idempotency lookup, persistence, retry storage, chargeback processing, or Kafka publication.
- Missing verification configuration fails closed.
- Provider transport/timeout failure returns service unavailable rather than accepting an unverified event.

Evidence:

- PayPal focused tests: `13 tests`, `0 failures`.
- Webhook idempotency/Stripe regression tests: `8 tests`, `0 failures`.
- Live PayPal sandbox verification remains externally blocked by missing provider credentials/access.

### 5. Payment gRPC service authentication

Primary files:

- `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/grpc/GrpcServiceAuthInterceptor.java`
- `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/grpc/GrpcPaymentServer.java`
- `services/payment-service/src/main/resources/application-grpc.yml`
- `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/grpc/GrpcClientConfig.java`
- `services/order-service/src/main/resources/application-grpc.yml`
- `services/payment-service/src/test/java/com/vnshop/paymentservice/infrastructure/grpc/GrpcPaymentServerTest.java`
- Kubernetes workload/secret references for `payment-grpc-service-token`

Changes:

- Added gRPC service ID and token metadata validation.
- Order-service attaches the configured payment-service identity/token.
- Payment-service rejects missing or invalid identity before invoking payment use cases.
- Production secret material remains external and is referenced through SealedSecret keys rather than committed.

Evidence:

- Payment and order services compiled.
- After clearing generated Maven `target` artifacts, focused gRPC suite passed: `8 tests`, `0 failures`.

### 6. NestJS tracing runtime repair

Primary files:

- `services/cart-service/src/tracing.ts`
- `services/messaging-service/src/tracing.ts`
- `services/notification-service/src/tracing.ts`
- `services/notification-service/src/main.ts`
- Tracing/bootstrap tests for all three services

Changes:

- Replaced legacy Jaeger exporter URLs hard-coded to `localhost:14268` with OTLP HTTP export.
- Reads `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`.
- Defaults to `http://jaeger:4318/v1/traces`.
- Notification tracing starts before `NestFactory.create()`.

Evidence:

- Cart focused tracing test passed; full suite `59/59`.
- Messaging focused tracing test passed; full suite `44/44`.
- Notification tracing/bootstrap tests passed; full suite `282/282` with `--forceExit` because existing asynchronous handles remain open.
- All three builds passed.
- Jaeger UI returned HTTP `200`; this does not by itself prove complete cross-service trace continuity.

### 7. Java OpenTelemetry runtime-agent launch

Primary files:

- Dockerfiles for the audited Java services.
- `services/seller-finance-service/pom.xml`
- `services/invoice-service/pom.xml`
- Corrected dependency-plugin configuration in inventory/search/payment/shipping POMs.
- `infra/scripts/test_java_otel_runtime_contract.py`

Changes:

- Java runtime images contain `/app/opentelemetry-javaagent.jar`.
- Runtime startup prepends `-javaagent:/app/opentelemetry-javaagent.jar` through `JAVA_TOOL_OPTIONS`.
- Added missing agent packaging to seller-finance and invoice services.

Evidence:

- Contract tests: `2 passed`.
- All 11 audited Java images built successfully.
- Image/container inspection found both `app.jar` and the agent JAR and confirmed the startup pattern.
- Full runtime trace export was not completed before the pause.

### 8. Secure-base Docker Compose

Primary files:

- `docker-compose.yml`
- `docker-compose.dev.yml` (new explicit development override)
- `docker-compose.override.yml` (deleted to prevent automatic unsafe loading)
- `.env.example`
- `README.md`
- `infra/scripts/test_compose_topology_contract.py`

Changes:

- Base Compose publishes only loopback gateway/frontend entry points.
- Internal services, databases, Kafka, Redis, MinIO, and observability ports are not host-published in the base topology.
- JDWP is removed from the auto-loaded base/override path.
- Explicit development configuration publishes selected ports on loopback only.
- JDWP binds to `127.0.0.1`, never `address=*:`.
- Invoice-service direct host port was removed; its `/api/v1` tax/GDT APIs remain internal-only.

Evidence:

- Compose topology contract: `3 passed`.
- Broader Compose/Kafka/Elasticsearch contracts: `46 passed` in the lane’s verification.
- Base and development Compose rendering passed.
- Secure-base stack was applied to Docker.
- API gate passed after secure-base application: `67 passed, 0 failed`.

### 9. API route classification

Decision:

- Do not add a broad `/api/v1/**` gateway route.
- Keep these current APIs internal-only until an explicit product/operator contract exists:
  - invoice-service `/api/v1/invoices/**`
  - invoice-service `/api/v1/sellers/**`
  - user-service `/api/v1/gdpr/**`
  - payment-service `/api/v1/admin/webhooks/**`
  - payment-service `/api/v1/chargebacks/**`
- Preserve order-service `/invoices/**` as the distinct buyer/seller invoice-download surface.

The direct invoice-service port was the actual exposure defect and was removed.

### 10. Kubernetes storage and backup hardening

Primary files:

- `infra/k8s/base/storage-bootstrap-job.yaml`
- `infra/k8s/base/jobs/db-backup-cronjob.yaml` (deleted)
- `infra/scripts/test_storage_bootstrap_contract.py`

Changes:

- Removed the inactive legacy unencrypted database backup CronJob.
- Kept the authoritative backup job, which uploads with S3 SSE AES256.
- Narrowed moderator storage access to staging read/delete and published-video write.
- Narrowed transcoder access to temporary-input read/delete and staging write.
- Preserved the existing public read-only policy for published videos.

Evidence:

- Storage/moderator contract tests: `9 passed`.
- Video moderator storage test: `1 passed`.
- Base, staging, and production Kustomize renders passed.
- Production inventory contained `CronJob/vnshop-authoritative-backup` and excluded legacy `db-backup`.

### 11. Staging/release policy classification

Primary files:

- `infra/compose/staging/docker-compose.staging.yml`
- `infra/scripts/deploy-staging.sh`
- `infra/scripts/validate-k8s-release.py`
- validator tests

Changes:

- Renamed the insecure staging-like Compose harness as explicit `local-only-dev` behavior.
- Deployment script uses the local-only profile and reports that status.
- Release validation now has clearer release-lock and placeholder-origin checks, including `.example.com`.
- Unsafe plaintext Kafka, auto-topic creation, and disabled Elasticsearch security remain only in the explicit local developer harness, not as shared-staging claims.

Evidence:

- Relevant unit/pytest validation: `18 tests OK` and focused `6 passed`.
- No remaining `--profile staging` references under `infra/` at that checkpoint.

### 12. Kubernetes ingress and network-policy hardening

Primary files:

- `infra/k8s/base/ingress/ingress-nginx-controller.yaml`
- `infra/k8s/base/network-policies.yaml`
- `infra/scripts/test_k8s_hardening_contracts.py`

Changes:

- Ingress controller now sets:
  - `allowPrivilegeEscalation: false`
  - `runAsNonRoot: true`
  - runtime-default seccomp
  - dropped capabilities except required `NET_BIND_SERVICE`
- RBAC remains explicit and read-only for discovery resources.
- Removed unbounded same-namespace ingress/egress rules.
- Removed open `0.0.0.0/0:443` egress from every VNShop workload in the base policy.
- Added explicit ingress-controller policies for frontend, API gateway, and MinIO.
- External provider HTTPS egress is now an operator-owned approved egress gateway/CIDR decision.

Evidence:

- Kubernetes hardening and existing topology contracts: `13 passed` after the final policy correction.
- Base Kustomize render passed.

## Partially implemented or not fully verified

### 1. Kafka and gRPC W3C trace propagation

The worktree contains transport-propagation changes, including files under:

- `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/observability/`
- order outbox publisher/tests
- payment/inventory/shipping gRPC trace interceptors
- messaging Kafka trace propagation and tests
- gRPC transport compatibility tests

The delegation implementing this lane was aborted before returning a final verification report. These edits must be treated as **partial and unverified** until all of the following are completed:

1. Inspect each changed propagation class and ensure OpenTelemetry propagators are used rather than hand-built `traceparent` strings.
2. Run focused order/payment/inventory/shipping/messaging tests.
3. Confirm existing deadlines, service authentication, Kafka idempotency, and payload schemas are unchanged.
4. Rebuild affected containers.
5. Trigger a real order/checkout flow and query Jaeger for one trace spanning the expected services.

### 2. Full combined verification

Focused lanes passed, but the full combined worktree has not received one final end-to-end verification pass after all changes were present together.

Still required:

- Changed-file diagnostics for the final combined diff.
- Full affected Java and NestJS suites.
- Final `docker compose config --quiet` for base and development configurations.
- Final API gate after the latest trace/policy edits.
- Targeted browser/Socket.IO smoke against the production Docker images.
- Jaeger cross-service trace evidence.
- Prometheus and Alertmanager endpoint/rule checks.
- All Kubernetes contract suites and renders together.
- Release validators, confirming failures are limited to external production values.
- `git diff --check` on the final combined diff.

### 3. Independent review

No final independent security, code-quality, and completion-verifier pass has been performed on the complete combined change set.

## Expected external release blockers

The release validators intentionally still fail on operator-owned values. Do not replace these with fabricated values:

- `infra/release/locks/staging.json` and `prod.json`.
- Real immutable application image digests.
- SBOM/provenance records.
- Populated SealedSecret ciphertext.
- Real HTTPS origins, DNS names, and certificates.
- Non-stub carrier/payment modes and provider credentials.
- Kafka TLS/credentials/cluster endpoints and replication capacity.
- Elasticsearch credentials/TLS/snapshot configuration.
- MinIO KMS/bucket ownership approvals.
- Backup bucket/IAM/KMS/object-lock/retention values.

Observed release-validator failures were consistent with these expected external blockers: missing locks, zero digests, empty SealedSecret, placeholder origins, stub/demo modes, and missing required runtime secrets.

## Audit findings addressed or reclassified

### Addressed

- Cart BOLA through caller-controlled `x-user-id`.
- Invoice seller-to-seller BOLA.
- PayPal chargeback webhook signature bypass.
- Unauthenticated payment gRPC calls.
- Kafka notification startup race and missing broker principal.
- NestJS container-invalid tracing endpoints.
- Missing notification tracing bootstrap.
- Java OTEL agent packaged-but-not-launched gap.
- Automatic wildcard JDWP exposure.
- Direct invoice-service host exposure.
- Broad video worker storage permissions.
- Legacy unencrypted backup manifest.
- Broad Kubernetes same-namespace/open-Internet network policy.
- Ingress controller privilege escalation.

### Reclassified or intentionally left internal

- Invoice/GDPR/payment admin `/api/v1` gateway routes are intentionally internal today; the fix is not to expose them.
- Notification Socket.IO already had strong service-level E2E/unit coverage; the remaining gap is a Docker/gateway/real-Keycloak smoke test.
- Health `401` was not confirmed as a current source defect; runtime reproduction is required before changing security rules.
- Production placeholder digests and empty SealedSecret are protected release blockers, not values to fabricate.
- Published videos are explicitly public read-only media. Other public-media classification should not change without product/data-owner approval.

## Explicit non-findings from the audit

The audit did not establish:

- FFmpeg shell injection.
- SQL injection.
- SSRF.
- CORS bypass.
- Configuration-service external authentication bypass.
- Public gateway exposure of video-moderator health probes.
- SePay, GHN, or GHTK signature bypasses.
- Messaging or notification REST identity bypass.

## Worktree ownership warning

Before this hardening implementation began, the worktree already contained unrelated or concurrent changes in areas including:

- frontend E2E and storefront files;
- shipping-service implementation/tests;
- Elasticsearch manifests/contracts;
- session handover and OMO notepads;
- some gateway and user-service files.

Do not revert, stage, or attribute those files without reviewing their history and current diff. The full `git diff --stat` at pause time covered roughly 98 tracked files plus multiple untracked files, and it includes both hardening work and unrelated concurrent work.

## Safe resume order

1. Read this handover and the tracked hardening plan.
2. Run `git status --short` and preserve unrelated changes.
3. Review the partial Kafka/gRPC propagation diff file-by-file.
4. Complete focused transport tests and obtain real Jaeger continuity evidence.
5. Run the full combined verification matrix.
6. Run independent security, code-quality, and completion-verifier reviews.
7. Update this handover with final counts and any remaining external blockers.
8. Do not commit unless explicitly requested.

## Last known strong evidence

- API gate after notification repair: `67 passed, 0 failed`.
- API gate after secure-base Compose application: `67 passed, 0 failed`.
- Cart: `59/59` after tracing work.
- Messaging: `44/44` after tracing work.
- Notification: `282/282` with `--forceExit`.
- Invoice: `7/7`.
- Payment gRPC focused: `8/8`.
- PayPal focused: `13/13`; related webhook regressions `8/8`.
- Compose topology: `3 passed`; broader lane reported `46 passed`.
- Storage/moderator contracts: `9 passed`; moderator storage unit `1 passed`.
- Kubernetes hardening/topology: `13 passed`.
- Base/staging/prod Kustomize renders passed at the infrastructure checkpoint.

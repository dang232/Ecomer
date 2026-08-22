# VNShop Security and Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Close all confirmed repository-owned VNShop audit findings in five independently verified waves while keeping external production inputs explicitly blocked.

**Architecture:** Secure the owning service boundary first, then make gateway routes explicit, then repair telemetry and deployment policy. Keep local convenience in an opt-in development profile and leave production values to operators.

**Tech Stack:** Java 25/Spring Boot 4.1, NestJS 11/TypeScript, KafkaJS/Kafka 8.2, gRPC, React/Playwright, Docker Compose, Kubernetes/Kustomize/Helm, Prometheus, Loki, Jaeger, Maven.

**Design reference:** `docs/superpowers/specs/2026-08-22-vnshop-hardening-design.md`

**Tracking rule:** Mark each checkbox only after its exact command and expected observable result are recorded. Never overwrite unrelated dirty files. Never commit fabricated secrets, digests, certificates, or approvals.

---

## Wave A: Application security

### Task 1: Lock cart identity ownership with a failing direct-boundary test

**Files:**
- Modify: `services/cart-service/src/cart/infrastructure/cart.controller.ts`
- Test: `services/cart-service/src/cart/infrastructure/cart.controller.spec.ts` or the existing controller test file discovered from the module
- Test: `services/api-gateway/src/main/java/com/vnshop/apigateway/infrastructure/filter/UserIdHeaderFilterTest.java` if gateway header behavior needs a regression assertion

- [ ] **Step 1: Identify the current controller test seam and fixture factory**
  - Run `rg -n "CartController|requireUserId|x-user-id|cart.controller" services/cart-service/src services/cart-service/test`.
  - Record the exact existing test command in this plan’s execution notes.

- [ ] **Step 2: Write the red test**
  - Given a request with no validated principal and an arbitrary `x-user-id`, when a cart read or mutation is invoked, then the controller rejects the request before the cart use case receives any user ID.
  - Use the repository’s existing NestJS guard/error convention; do not assert implementation-only private calls.

- [ ] **Step 3: Run the focused test and capture the failure**
  - Run the exact controller test with `npm test -- --runInBand` or the package’s documented focused Jest command.
  - Expected red result: the current controller accepts the header or reaches the use case.

- [ ] **Step 4: Implement the smallest boundary fix**
  - Require the validated JWT request identity used by the service’s existing auth guard.
  - Remove caller-controlled identity fallback for externally reachable cart operations.
  - Preserve gateway-injected context only through the service’s documented trusted-internal path, if one exists and is authenticated.

- [ ] **Step 5: Run focused tests and direct manual QA**
  - Run the cart service unit suite.
  - With Docker running, call the cart service directly with only `x-user-id` and confirm `401/403`; call through the gateway with a real buyer token and confirm normal cart behavior.

- [ ] **Step 6: Record completion**
  - Mark this task complete only when the red test, green test, direct rejection, gateway happy path, and changed-file diagnostics are captured.

### Task 2: Enforce invoice resource ownership across all invoice-service operations

**Files:**
- Modify: `services/invoice-service/src/main/java/com/vnshop/invoiceservice/infrastructure/web/InvoiceController.java`
- Modify: `services/invoice-service/src/main/java/com/vnshop/invoiceservice/application/InvoiceService.java`
- Modify: `services/invoice-service/src/main/java/com/vnshop/invoiceservice/domain/repository/InvoiceRepository.java` and its adapter only if ownership query support is missing
- Test: existing invoice controller/application security tests plus a cross-seller regression test

- [ ] **Step 1: Map all current invoice methods and ownership data**
  - Inspect every controller method, the `Invoice` entity’s buyer/seller fields, and repository query methods.
  - Confirm whether invoice generation is already protected by order/sub-order ownership and preserve that behavior.

- [ ] **Step 2: Write red cross-tenant tests**
  - Given seller A and an invoice belonging to seller B, when seller A requests order lookup, GDT status, XML, submission, resubmission, or seller listing with seller B’s ID, then the request returns `403/404` and no sensitive data or downstream submission occurs.
  - Given the buyer who owns an order, preserve only the explicitly documented buyer operation.

- [ ] **Step 3: Run tests and confirm the current unauthorized access**
  - Run the focused Maven tests and capture the failing authorization assertions.

- [ ] **Step 4: Implement ownership authorization at the application boundary**
  - Parse the authenticated subject once.
  - Require seller ownership for seller operations, buyer/order ownership for buyer operations, and the existing finance-admin role for operator operations.
  - Do not authorize using request `sellerId` or arbitrary order identifiers alone.

- [ ] **Step 5: Run invoice tests and a Docker gateway scenario**
  - Run `./mvnw.cmd test` in `services/invoice-service`.
  - Exercise seller A against seller B’s invoice through the intended gateway route and verify denial.

### Task 3: Make PayPal chargeback verification cryptographic and fail closed

**Files:**
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/web/PayPalChargebackWebhookController.java`
- Create or modify: typed PayPal webhook verifier under `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/webhook/`
- Modify: payment configuration properties and Docker/Kubernetes environment contracts
- Test: PayPal webhook controller/verifier tests and a negative forged-payload test

- [ ] **Step 1: Confirm provider SDK/client conventions and current timeout utilities**
  - Inspect payment outbound HTTP clients and provider configuration before choosing the existing client seam.
  - Use the official PayPal Verify Webhook Signature API contract; do not hand-roll certificate-chain verification if the repository already has a provider client abstraction.

- [ ] **Step 2: Write red tests**
  - Given a payload with a nonblank auth header but an invalid signature, when the webhook is posted, then response is non-success and no chargeback persistence, idempotency mark, retry record, or Kafka event occurs.
  - Given missing webhook credentials, the endpoint remains unavailable/fails closed.
  - Given a verified event, existing idempotency behavior remains unchanged.

- [ ] **Step 3: Run the focused payment tests and capture red output**
  - Run the relevant Maven test class before implementation.

- [ ] **Step 4: Implement typed verification**
  - Build the verification request with webhook ID, event body, transmission ID/time/signature/cert URL/auth algorithm headers, and the configured PayPal environment.
  - Bound connect/read timeouts.
  - Accept only an explicit `SUCCESS` verification response.
  - Return a retryable server response for provider verification outages without persisting an unverified event.

- [ ] **Step 5: Verify the real boundary**
  - Run the payment suite.
  - Use a forged local request against the gateway and prove it cannot create a chargeback.
  - Leave live-provider manual smoke blocked unless sandbox credentials are present.

### Task 4: Authenticate payment gRPC and preserve service-to-service compatibility

**Files:**
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/grpc/GrpcPaymentServer.java`
- Modify: payment gRPC client configuration and service identity configuration
- Modify: `services/order-service` gRPC client configuration if it is the caller
- Test: existing `GrpcPaymentServerTest` and client/server metadata integration test

- [ ] **Step 1: Write the red unauthenticated-call test**
  - Given a plaintext gRPC client without service-auth metadata, when `requestPayment` is invoked, then the server rejects it before `processInternal` runs.

- [ ] **Step 2: Run the test and capture current unauthenticated success**
  - Run the focused gRPC test; expected red result documents the current vulnerability.

- [ ] **Step 3: Implement authenticated metadata validation**
  - Prefer the repository’s existing service-token/JWT convention.
  - Add a server interceptor that validates the caller identity and rejects missing/invalid metadata.
  - Do not silently accept a shared user-controlled header.

- [ ] **Step 4: Add transport protection appropriate to each topology**
  - Keep local Compose internal-only unless the project already has a trusted local TLS contract.
  - Configure Kubernetes service identity/network policy and TLS/mTLS hooks without fabricating certificates.

- [ ] **Step 5: Run client/server integration and order/payment flow QA**
  - Verify authenticated order-to-payment calls still succeed and unauthenticated calls fail.

---

## Wave B: API contracts and gateway boundaries

### Task 5: Add explicit, authorized gateway routes for intended APIs

**Files:**
- Modify: `services/api-gateway/src/main/java/com/vnshop/apigateway/infrastructure/route/RouteConfig.java`
- Modify: `services/api-gateway/src/main/java/com/vnshop/apigateway/infrastructure/config/SecurityConfig.java`
- Modify: route/security tests under `services/api-gateway/src/test/`
- Modify: service API documentation only where it reflects the canonical path

- [ ] **Step 1: Classify each route before editing**
  - Invoice tax/GDT API: expose through an explicit `/api/v1/invoices/**` route only if operator/service consumers require gateway access; otherwise document it as internal and remove direct host exposure.
  - GDPR API: expose through an explicit user-authenticated route if it is a supported user contract.
  - Payment admin DLT/chargeback APIs: expose only under explicit admin roles if an operator UI requires them; otherwise keep internal and remove direct exposure.
  - Do not add `/api/v1/**` catch-all.

- [ ] **Step 2: Write route and authorization red tests**
  - Assert intended paths reach the owning service.
  - Assert same-prefix paths cannot reach the wrong service.
  - Assert unauthenticated and wrong-role requests are rejected.

- [ ] **Step 3: Implement route ordering and security**
  - Place specific predicates before generic domain routes.
  - Strip/rewrite paths only where the owning controller requires it.
  - Preserve the gateway-only internal-port rule.

- [ ] **Step 4: Run gateway route/security tests and manual curl probes**
  - Verify `401/403`, correct upstream ownership, and no direct internal-port dependency.

### Task 6: Resolve shipping rate contract duplication

**Files:**
- Modify: `services/shipping-service` rate controllers only if compatibility/deprecation behavior is needed
- Modify: `fe/src/shared/api/endpoints/shipping.ts` only if the canonical path changes
- Test: shipping controller/contract tests and API gate contract tests

- [ ] **Step 1: Confirm all repository consumers**
  - Run `rg -n "rate-quotes|shipping/rates|shipping-options" services fe infra docs`.

- [ ] **Step 2: Write a contract test for the canonical path**
  - Assert frontend/order checkout uses `/shipping/rates` or the selected canonical contract.
  - Assert the compatibility endpoint is either intentionally marked deprecated or removed from public routing.

- [ ] **Step 3: Implement the smallest compatibility-safe change**
  - Do not remove a path with an active consumer.
  - Add an explicit deprecation marker/documentation if both paths must remain.

### Task 7: Add production-image notification Socket.IO smoke coverage

**Files:**
- Create/modify: `infra/scripts` Docker-backed notification Socket.IO smoke test
- Modify: `fe/e2e` or service E2E only if the existing runner is the correct surface
- Modify: gateway route/security tests if a missing route assertion is found

- [ ] **Step 1: Build a real authenticated smoke fixture**
  - Obtain a real local Keycloak token, connect to `ws://localhost:8080/ws/notifications`, trigger a notification through the normal path, receive it, send ACK, and observe disconnect/reconnect behavior.

- [ ] **Step 2: Run the smoke test before any coverage change**
  - Record whether the current Docker image and gateway route pass or fail.

- [ ] **Step 3: Fix only the failing route/auth/adapter seam**
  - Preserve existing service-level Socket.IO tests that already cover mocked JWT/JWKS behavior.

---

## Wave C: Observability

### Task 8: Launch Java OpenTelemetry agents in runtime images

**Files:**
- Modify active Java service `Dockerfile` files that package OTEL but do not launch it
- Modify: `services/seller-finance-service/pom.xml` and `services/invoice-service/pom.xml` if the agent artifact is absent
- Add Docker/build contract tests under `infra/scripts` or the existing test location

- [ ] **Step 1: Inventory all Java Dockerfiles and POM agent wiring**
  - Run the audit commands from the observability map and create the exact active-service list.

- [ ] **Step 2: Write a failing contract test**
  - Every active Java runtime image must contain the agent path and launch with `-javaagent` through `JAVA_TOOL_OPTIONS` or an equivalent explicit command.

- [ ] **Step 3: Implement the minimum common runtime pattern**
  - Copy the agent to `/app/opentelemetry-javaagent.jar`.
  - Set `JAVA_TOOL_OPTIONS` in the image only when the environment has not already supplied it, preserving debug options.
  - Add missing POM dependency/copy configuration for seller-finance and invoice.

- [ ] **Step 4: Build affected images and verify Jaeger service inventory**
  - Confirm application service names appear and a gateway-to-service request produces a trace.

### Task 9: Fix NestJS tracing endpoint and notification bootstrap

**Files:**
- Modify: `services/cart-service/src/tracing.ts`
- Modify: `services/messaging-service/src/tracing.ts`
- Modify: `services/notification-service/src/tracing.ts`
- Modify: `services/notification-service/src/main.ts`
- Test: tracing configuration/bootstrap tests for all three services

- [ ] **Step 1: Write red endpoint-selection tests**
  - Set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` to a non-local endpoint and assert exporter construction uses it.
  - Assert no Compose-mode default resolves to `localhost:14268`.
  - Assert notification bootstrap invokes tracing before `NestFactory.create`.

- [ ] **Step 2: Implement environment-driven OTLP HTTP export**
  - Prefer `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and the existing `http://jaeger:4318/v1/traces` Compose value.
  - Keep an explicit non-Compose local fallback only where existing tests or documented CLI usage require it.

- [ ] **Step 3: Run service tests and Docker smoke**
  - Verify `cart-service`, `messaging-service`, and `notification-service` appear in Jaeger after real requests.

### Task 10: Standardize Kafka and gRPC trace propagation

**Files:**
- Create shared Java propagation interceptor/utilities in the existing gateway/service shared package or the smallest existing common module
- Modify Java Kafka producer/consumer configuration and gRPC client/server configuration
- Modify: `services/messaging-service/src/messaging/application/kafka-message.publisher.ts`
- Modify: `services/messaging-service/src/messaging/application/kafka-message.consumer.ts`
- Modify: `services/notification-service/src/notification/infrastructure/messaging/kafka-event.consumer.ts`
- Test: producer header, consumer extraction, and gRPC metadata integration tests

- [ ] **Step 1: Write red propagation tests**
  - Given an active parent span, a Kafka producer emits `traceparent`/`tracestate` headers.
  - Given Kafka headers, a consumer creates a child span.
  - Given gRPC metadata, server code sees the extracted parent context.

- [ ] **Step 2: Implement W3C propagation through transport metadata**
  - Use OpenTelemetry propagators; do not manually concatenate trace IDs or add them to JSON business payloads.
  - Preserve existing Kafka idempotency and gRPC deadlines/circuit breakers.

- [ ] **Step 3: Run focused transport tests and a real cross-service trace**
  - Trigger checkout/order flow and query Jaeger for a trace containing the expected service spans.

### Task 11: Verify probe authorization and align monitoring rules

**Files:**
- Modify only the actual failing security/config path after runtime reproduction
- Modify: `infra/prometheus/prometheus.yml`, rule files, and Alertmanager config only for confirmed current gaps
- Test: probe/security/metrics contract tests

- [ ] **Step 1: Run all direct and gateway probe commands**
  - Compare `/actuator/health`, `/actuator/health/readiness`, `/actuator/health/liveness`, and Nest `/health`/`/ready` responses.

- [ ] **Step 2: If 401 is not reproduced, record the finding as stale and do not edit security**
  - This is required by the current source audit.

- [ ] **Step 3: If reproduced, fix the exact path pattern**
  - Keep liveness process-only and readiness dependency-aware.

- [ ] **Step 4: Align scrape targets/rules and validate Alertmanager receiver behavior**
  - Do not add high-cardinality labels or page on causes without an owner/runbook.

---

## Wave D: Infrastructure and supply chain

### Task 12: Make Compose secure by default and debugging opt-in

**Files:**
- Modify: `docker-compose.yml`
- Modify/create: `docker-compose.override.yml` or an explicit `docker-compose.dev.yml`
- Modify: `.env.example` and local setup documentation
- Test: Compose topology contract script

- [ ] **Step 1: Write topology contract tests**
  - Default rendered Compose must not publish internal service, database, Redis, MinIO, or JDWP ports.
  - Default rendered Compose must not contain wildcard JDWP `address=*:`.
  - Dev override must be explicit and bind debug ports to loopback.

- [ ] **Step 2: Implement secure base and opt-in dev profile**
  - Preserve gateway/frontend/observability access needed by local QA.
  - Move selected developer-only ports into the opt-in file/profile.
  - Remove automatic wildcard debug exposure.

- [ ] **Step 3: Run Compose render and startup checks**
  - Confirm notification/Kafka readiness and rerun the API gate.

### Task 13: Tighten Kubernetes ingress, network, storage, and backup policy

**Files:**
- Modify: `infra/k8s/base/network-policies.yaml`
- Modify: `infra/k8s/base/ingress/ingress-nginx-controller.yaml`
- Modify: `infra/k8s/base/storage-bootstrap-job.yaml`
- Delete/archive from active kustomization: `infra/k8s/base/jobs/db-backup-cronjob.yaml`
- Modify: `infra/k8s/base/kustomization.yaml` only to ensure one authoritative encrypted backup job
- Test: existing topology/storage/video contract tests plus new negative access tests

- [ ] **Step 1: Inventory required service flows before narrowing policies**
  - Derive ingress, DNS, Kafka, databases, Redis, MinIO, Elasticsearch, telemetry, backup, and provider flows from manifests and service config.

- [ ] **Step 2: Write red policy tests**
  - Assert no broad same-namespace allow-all policy remains.
  - Assert ingress controller has `allowPrivilegeEscalation: false`.
  - Assert active backup manifests include encryption and exclude legacy unencrypted CronJob.
  - Assert moderator/transcoder policies cannot delete public objects unless explicitly approved.

- [ ] **Step 3: Implement code-owned policy tightening**
  - Narrow selectors and ports without inventing external CIDRs.
  - Remove unnecessary RBAC permissions while preserving required ingress discovery.
  - Keep storage policy changes limited to clearly unneeded wildcard operations; classify public media separately.

- [ ] **Step 4: Render Kustomize and run contract suites**
  - Run `kubectl kustomize` for base/staging/prod and all relevant Python contract suites.

### Task 14: Harden shared staging and release validators without fabricating values

**Files:**
- Modify: `infra/compose/staging/docker-compose.staging.yml`
- Modify: `infra/scripts/validate-k8s-release.py` and related tests only where validators miss unsafe patterns
- Modify: release documentation and lock README only to explain required operator inputs

- [ ] **Step 1: Write red staging-policy tests**
  - Shared-staging rendering must require credentials and reject plaintext Kafka, disabled Elasticsearch security, auto-topic creation, and broad host ports.

- [ ] **Step 2: Parameterize staging secrets and gate unsafe local-only mode**
  - Preserve a separately named local harness if needed.
  - Do not put real values in Git.

- [ ] **Step 3: Improve validator diagnostics**
  - Ensure missing release locks, zero digests, empty SealedSecret, placeholder origins, stub/demo modes, and missing required runtime keys are each reported with an actionable operator instruction.

- [ ] **Step 4: Run validators**
  - Expected result: code-owned unsafe-pattern tests pass; prod/staging release validation still fails only on missing external inputs.

### Task 15: Add Maven wrapper and build-input integrity checks

**Files:**
- Modify active `services/*/.mvn/wrapper/maven-wrapper.properties`
- Modify: CI workflow or wrapper contract tests
- Test: wrapper checksum/tamper test

- [ ] **Step 1: Determine active wrapper inventory**
  - Enumerate all 11 wrapper files and distinguish archived coupon-service policy.

- [ ] **Step 2: Obtain and verify the official Maven 3.9.15 SHA-256**
  - Use the official Apache distribution/checksum source; do not guess or copy an unverified value.

- [ ] **Step 3: Add checksum fields and red/green wrapper tests**
  - A valid archive launches; a modified archive is rejected.

- [ ] **Step 4: Run wrapper startup in each active service and CI contract checks**

---

## Wave E: Full verification and independent review

### Task 16: Run changed-file diagnostics and focused suites

- [ ] **Step 1:** Run LSP diagnostics for every changed source/config file.
- [ ] **Step 2:** Run affected Java, NestJS, Python contract, and TypeScript suites.
- [ ] **Step 3:** Run `git diff --check` and inspect only audit-owned diffs separately from pre-existing worktree changes.

### Task 17: Run real integration and manual QA surfaces

- [ ] **Step 1:** Start the secure-base Compose stack and verify health/DNS/readiness.
- [ ] **Step 2:** Run `node infra/scripts/e2e-day.mjs`.
- [ ] **Step 3:** Run targeted Playwright checkout/auth/admin/notification flows.
- [ ] **Step 4:** Run real gRPC rejection/happy-path probes.
- [ ] **Step 5:** Query Jaeger services/traces and Prometheus/Alertmanager endpoints.
- [ ] **Step 6:** Render Kubernetes manifests and run all release/static validators.

### Task 18: Independent security and quality review

- [ ] **Step 1:** Dispatch a read-only security reviewer against the final diff and the original findings.
- [ ] **Step 2:** Dispatch a verifier to check every plan checkbox has evidence.
- [ ] **Step 3:** Dispatch a code reviewer for authorization, provider verification, and policy regressions.
- [ ] **Step 4:** Fix only review findings caused by this hardening work, then rerun affected gates.

## External blocker ledger

These are intentionally tracked as blocked, not silently “fixed”:

- Production/staging image digests and release locks.
- SBOM/provenance attestations.
- SealedSecret ciphertext.
- Kafka TLS/credentials/advertised endpoints/replication capacity.
- Elasticsearch TLS/passwords/cluster sizing.
- MinIO KMS/bucket classification/ownership approval.
- Backup KMS/IAM/object-lock/retention values.
- Public DNS/origins/certificates.
- PayPal and other provider credentials.
- Official Maven checksum until independently verified.

# VNShop Security and Reliability Hardening Design

**Date:** 2026-08-22
**Status:** Approved for tracked implementation
**Policy decision:** Secure base Compose defaults with an explicit opt-in development profile

## Goal

Remove every confirmed repository-owned security, API-boundary, observability, and deployment-hardening defect from the August 2026 audit, while preserving unrelated worktree changes and refusing to invent external production secrets, image digests, certificates, provider credentials, or data-classification approvals.

## Scope

### In scope

1. Cart identity and direct-service authorization.
2. Invoice resource ownership and gateway reachability.
3. PayPal chargeback authenticity and fail-closed behavior.
4. Payment gRPC authentication and transport policy.
5. Explicit gateway routes for intended API-v1 operator/user surfaces.
6. Java and NestJS OpenTelemetry runtime wiring.
7. Kafka and gRPC trace-context propagation.
8. Runtime probe verification and notification Docker/gateway smoke coverage.
9. Secure-base Compose defaults and opt-in development debugging.
10. Kubernetes ingress security context, RBAC review, network policy tightening, storage least privilege, and legacy backup removal.
11. Staging security guards and release-contract tests.
12. Maven wrapper and build-input integrity checks.
13. A tracked implementation plan with red/green tests, validation commands, and explicit external blockers.

### Out of scope until external inputs exist

- Production image digests, release locks, SBOM/provenance attestations.
- SealedSecret ciphertext and plaintext production credentials.
- PayPal/GHN/GHTK/SePay/VNPay/MoMo live credentials and provider onboarding.
- Kafka TLS certificates, broker credentials, advertised production endpoints, and replication capacity.
- Elasticsearch TLS material, passwords, cluster sizing, and snapshot credentials.
- MinIO KMS identifiers, bucket ownership approvals, and public/private media classification decisions.
- Backup bucket, IAM, KMS, object-lock, retention, and restore-environment values.
- Public DNS names, TLS certificates, and production Keycloak origins.

## Architecture decisions

### 1. Secure base plus explicit development profile

The default Compose topology exposes only intended user-facing entry points. Direct service, database, Redis, MinIO, and JDWP ports are not published by default. A clearly named local development override/profile may restore selected ports, but JDWP binds to loopback and never uses wildcard `address=*:`. Weak credentials remain confined to local-only setup and are not accepted by shared staging or release validators.

### 2. Authentication at the owning boundary

The gateway may inject contextual identity headers after validating a JWT, but service endpoints must not treat a caller-supplied identity header as authentication. Cart derives identity from the validated request principal or a trusted internal authentication mechanism. Invoice operations authorize the requested resource against the current subject. Payment gRPC uses authenticated service identity and rejects unauthenticated plaintext calls.

### 3. Provider callbacks fail closed

PayPal chargebacks are accepted only after PayPal webhook signature verification succeeds. The verifier uses typed configuration, bounded outbound timeouts, provider-environment base URLs, and fail-closed behavior when verification configuration is absent or unavailable. Existing idempotency and retry persistence remain intact.

### 4. Explicit API ownership

The gateway adds only explicit, narrowly authorized routes for APIs that are intended to be reachable through the edge. It does not add a broad `/api/v1/**` catch-all. Invoice-service tax/GDT APIs remain distinct from order-service buyer invoice APIs. Shipping keeps one canonical rate contract; a compatibility alias is retained only if current consumers require it and is marked for deprecation.

### 5. Telemetry must be launched and propagated

Java images launch the OpenTelemetry agent that their builds package. NestJS tracing reads the configured OTLP endpoint instead of hard-coding container-local Jaeger endpoints, and notification starts tracing before Nest application creation. W3C trace context crosses HTTP, Kafka, and gRPC through headers/metadata, never business payload fields. Liveness remains process-only; readiness includes dependencies and is verified against actual deployment paths.

### 6. Code-owned versus operator-owned release gates

Repository changes improve policy, validators, and fail-closed behavior. They do not fabricate external release values. Release validators must continue to fail with actionable messages until operators provide real locks, digests, secrets, certificates, origins, provider credentials, and approvals.

## Wave boundaries

### Wave A: Application security

Cart, invoice, PayPal, payment gRPC, and regression tests. This wave must close direct exploit paths before broader infrastructure changes.

### Wave B: API contract and edge authorization

Gateway route ownership, explicit API-v1 routes, shipping contract classification, and notification Docker/gateway smoke coverage.

### Wave C: Observability

Java agent launch, Nest OTLP endpoint/startup, Kafka/gRPC propagation, probe runtime verification, Prometheus/Alertmanager alignment, and Jaeger evidence.

### Wave D: Infrastructure and supply chain

Secure Compose defaults, opt-in debug, staging guards, Kubernetes RBAC/security context/network/storage policy, legacy backup removal, and Maven/build integrity checks.

### Wave E: Release verification and review

Targeted tests, API/browser/manual QA, release validators, trace queries, diff review, and an independent security/verifier pass.

## Error and compatibility policy

- Unauthorized resource access returns `401` or `403` according to the existing service convention; it never falls back to caller-supplied identity.
- Invalid or unverifiable PayPal callbacks return a non-success response and do not persist or publish a chargeback.
- Unauthenticated gRPC calls fail before invoking application use cases.
- Missing production secrets/digests/certificates cause release validation failure, not local placeholder substitution.
- Existing local API behavior remains available through the gateway; only direct internal-port access and unsafe defaults are removed from the secure base.
- Existing successful Kafka notification startup and `67/67` API behavior must remain green after each relevant wave.

## Verification contract

Every implementation task must include:

1. A failing regression test or contract check before the fix.
2. The smallest implementation that makes it pass.
3. Focused unit/integration tests.
4. A real surface check where applicable: HTTP, gRPC, Kafka, Docker, browser, or rendered Kubernetes manifests.
5. Changed-file diagnostics and `git diff --check`.

The final gate requires:

- `docker compose config --quiet`.
- Relevant Java/Nest/Python/FE suites.
- `node infra/scripts/e2e-day.mjs` with `67 passed, 0 failed` or an updated evidence-backed count.
- Targeted browser/Socket.IO smoke coverage.
- Jaeger service and trace evidence for at least one cross-service request.
- Kubernetes/static contract tests green.
- Release validators failing only on declared external inputs.
- No untracked temporary audit artifacts.

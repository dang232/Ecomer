# Production Readiness Closure Plan

Status: PR #320 repository-owned closure approved. Final Wave is **APPROVE** for the 32-task scope;
production promotion remains blocked by external deployment, provider, broker, and browser evidence.

This plan closes repository-owned correctness and safety gaps while keeping local stubs
explicitly local. The existing [`PRODUCTION-READINESS-REVIEW.md`](PRODUCTION-READINESS-REVIEW.md)
remains the release ledger for PR-000 through PR-015 and the code-owned backlog PR-016 through
PR-023.

## PR #320 Final Wave

The completed wave is recorded in `.omo/evidence/vnshop-deep-fix/*.log` and the current handover.
It adds authoritative parcel variants, durable saga/outbox and DLT replay, principal-scoped idempotency,
HMAC/JWT and mTLS boundaries, fail-closed Compose passwords, the canonical Kafka manifest, HA and
Prometheus/Grafana alert contracts, `/api/v1` plus 90-day `Sunset`, RFC 7807 `problem+json` with
`traceId`, cache jitter/negative TTL/single-flight, Java 25 class splits, FE contract boundaries,
Flutter six-route and COD/VietQR/SePay parity, synchronized language resources, ARIA and contrast
coverage, and responsive immutable image/CDN policy.

The approval is repository-scoped. GHCR fixtures are not published, SealedSecret values are external,
live Compose requires an environment file, and broker/browser runtime proof is gated. MoMo and VNPay
remain disabled. No retroactive parcel or order backfill is included.

## Execution Order

### 1. Fail closed on production configuration and webhook security

Update shipping signature services and configuration validation so missing webhook secrets,
localhost endpoints, stub/demo provider modes, placeholder identities, and missing required
secrets cannot pass staging/production readiness. Retain unsigned webhook behavior only behind
an explicit local profile/flag whose default is false.

Primary files:

- `services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/webhook/GhnWebhookSignatureService.java`
- `services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/webhook/GhtkWebhookSignatureService.java`
- `services/shipping-service/src/main/resources/application.yml`
- configuration clients and security configuration in gateway, payment, order, user, and shipping services

Proof: real signature validators reject blank credentials; security-enabled MockMvc tests use
real validators; production-profile context tests fail on unsafe values; local tests opt in.

### 2. Route checkout shipping through carrier ports

This code-owned slice is implemented by PR #314. The gRPC path now invokes `CreateLabelCommand` through
`CreateLabelUseCase`, returns carrier labels, propagates provider failure, persists label records, and
routes cancellation through the carrier path. The remaining code-owned work is to expose trusted parcel
metadata from product/cart responses so the React checkout can submit the required fields.

Primary files:

- `services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/grpc/GrpcShippingServer.java`
- `services/shipping-service/src/main/java/com/vnshop/shippingservice/application/CreateLabelCommand.java`
- `services/shipping-service/src/main/java/com/vnshop/shippingservice/domain/port/out/CarrierGatewayPort.java`
- `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/grpc/GrpcShippingRequestAdapter.java`
- `services/order-service/src/main/java/com/vnshop/orderservice/application/CreateOrderUseCase.java`

Proof: fake gateway invocation test, provider failure compensation test, carrier request mapping tests,
and a browser checkout test using authoritative parcel metadata. No production-path test may accept a
generated synthetic label.

### 3. Make all commerce events durable

Fix payment callback relay to mark published only after bounded Kafka acknowledgment. Add a
durable cancellation outbox for shipping compensation and route inventory release fallback
through the order outbox. Add a product-service lifecycle outbox written in the product
transaction. Search must retry or repair Elasticsearch failures instead of marking those events
processed immediately.

Primary files:

- `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/event/PaymentCallbackOutboxRelay.java`
- `services/shipping-service/src/main/java/com/vnshop/shippingservice/application/CancelShipmentUseCase.java`
- `services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/event/ShippingEventPublisher.java`
- `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/grpc/GrpcInventoryReservationAdapter.java`
- `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/event/ProductEventPublisher.java`
- `services/search-service/src/main/java/com/vnshop/searchservice/infrastructure/kafka/ProductEventConsumer.java`

Proof: exceptional and timed-out Kafka futures leave rows retryable; only acknowledged sends
mark published; broker outage, duplicate event, Elasticsearch failure, and dead-letter tests
all pass.

### 4. Consolidate cart merge

Expose one authenticated merge endpoint, make the repository operation transactional across
user-cart write and guest-cart delete, invalidate both cache keys after commit, and make the
operation idempotent by session/merge key. Replace frontend per-item replay with this endpoint
while preserving explicit consent and failed guest data.

Primary files:

- `services/cart-service/src/cart/infrastructure/cart.controller.ts`
- `services/cart-service/src/cart/application/merge-cart.use-case.ts`
- `services/cart-service/src/cart/domain/cart.repository.ts`
- `services/cart-service/src/cart/infrastructure/cart-persistence.service.ts`
- `fe/src/app/hooks/use-cart.ts`

Proof: 5 + 2 becomes 7 once under retry/concurrency; rollback preserves both carts; keep
separate makes no merge request; browser reload cannot double quantities.

### 5. Remove fail-open inventory behavior

Reject reservation when no projected stock row exists. Then complete the product-to-inventory
projection if automatic product availability is required. Seed/setup scripts must create stock
explicitly for local flows.

Primary file: `services/inventory-service/src/main/java/com/vnshop/inventoryservice/application/ReserveStockUseCase.java`.

Proof: missing projection rejects checkout, insufficient stock remains atomic, and projected
stock reserves/releases correctly.

### 6. Complete notification retry and operational observability

Replace `RetryFailedDeliveriesUseCase` placeholder behavior with a scheduled retry/DLQ path,
or document and enforce an approved disabled-channel policy. Provider credentials remain an
external staging/production prerequisite.

Primary files:

- `services/notification-service/src/notification/application/command/retry-failed-deliveries.use-case.ts`
- notification channel adapters and delivery-status persistence

Proof: failed delivery is requeued with bounded backoff, exhausted work is visible in DLQ/alerts,
and disabled channels cannot be mistaken for successful external delivery.

## Explicitly Left Behind

The following require platform, credentials, provider, or business-owner evidence and are not
closed by source changes or local tests:

- real image digests, sealed production secrets, public origins, and release artifacts;
- live GHN/GHTK/payment credentials, independent webhook secrets, and provider approval;
- multi-broker Kafka with TLS/replication and secured Elasticsearch/network policy;
- approved FX stale-rate policy and real legal invoice identity;
- coupon-service ownership and migration decision;
- shared staging DNS, gRPC targets, Kafka advertisement, and remote smoke testing;
- release mobile endpoint injection and CI carrier/release coverage;
- notification provider credentials, video worker quotas, tmpfs enforcement, and durable
  media retry policy.
- the browser product/cart contract does not yet carry trusted parcel dimensions into checkout;
- cart E2E requires a real PostgreSQL/Redis test environment (`DATABASE_URL` is mandatory).

Each remains `blocked-external` in the readiness ledger until an owner supplies evidence.

## Release Gate

Do not mark the repository ready until:

1. Code-owned backlog PR-016 through PR-023 has passing targeted tests and integration failure tests.
2. Staging/production rendered manifests contain no unsafe local defaults or placeholder values.
3. Kafka/outbox, webhook, cart merge, inventory, and configuration smoke tests produce fresh evidence.
4. All external leftovers above have an owner, supplied evidence, and an explicit approval.

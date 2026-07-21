# Production Readiness Review

> Review date: 2026-07-22
> Scope: repository-wide review of local fallbacks, hardcoded local infrastructure, provider modes, and deployment placeholders.
> Review mode: independent code-quality and architecture lanes plus repository evidence inspection.

## Verdict

**REQUEST CHANGES - do not treat the current tree as production-ready.**

The application architecture is substantial and the main domain paths are implemented, but the server
deployment still contains non-production defaults and incomplete promotion artifacts. The most important
issues are deployment-level: production Kustomize keeps stub/demo provider modes, image digests are all
zero placeholders, and the runtime SealedSecret has no encrypted data.

## Review method

- Enumerated all 19 service directories, deployment overlays, Compose files, `.env` templates, and client configuration loaders.
- Searched source and manifests for `localhost`, `127.0.0.1`, `stub`, `demo`, `sandbox`, `fallback`, `mock`, `default`, credentials, and provider flags.
- Inspected the configuration service, carrier/payment configuration, frontend/mobile endpoint loaders, Kubernetes overlays, and local staging Compose.
- Ran independent `code-reviewer` and `architect` review lanes. Their outputs were used as review evidence and reconciled with the file-level findings below.

## Findings

### CRITICAL

#### PR-000 - Stub-mode carrier webhooks accept unsigned requests

- **Locations:** [`services/api-gateway/src/main/java/com/vnshop/apigateway/infrastructure/config/SecurityConfig.java`](../services/api-gateway/src/main/java/com/vnshop/apigateway/infrastructure/config/SecurityConfig.java):88; [`services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/webhook/GhnWebhookSignatureService.java`](../services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/webhook/GhnWebhookSignatureService.java):40-47; [`services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/webhook/GhtkWebhookSignatureService.java`](../services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/webhook/GhtkWebhookSignatureService.java):44-51; [`services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/event/ShippingEventPublisher.java`](../services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/event/ShippingEventPublisher.java):59-79.
- **Evidence:** The gateway permits the two webhook routes without JWT auth. When carrier mode is not `live` and no webhook token is configured, the signature services accept a missing token/signature. The default deployment carrier mode is `stub`.
- **Risk:** An unauthenticated caller can submit a syntactically valid webhook and cause shipment status events to be accepted and published to Kafka. This is exploitable if the production overlay inherits the stub path.
- **Remediation:** Keep gateway auth bypass only for the webhook adapter, but require independent GHN/GHTK verification secrets in every non-test environment. Reject unsigned requests regardless of carrier mode outside an explicitly isolated test profile, and add security-enabled MockMvc tests for both routes.

#### PR-001 - Production image digests are placeholders

- **Location:** [`infra/k8s/overlays/prod/kustomization.yaml`](../infra/k8s/overlays/prod/kustomization.yaml):49-104
- **Evidence:** Every image digest is `sha256:` followed by 64 zeroes.
- **Risk:** The production overlay does not identify a real immutable artifact. Deployment can fail to pull, deploy an unusable placeholder, or lose the release-to-runtime provenance that digest pinning is meant to provide.
- **Remediation:** CI must update the overlay with the digest produced by the release build, reject all-zero digests in validation, and verify that every digest exists in GHCR before Argo CD promotion.

#### PR-002 - Production runtime secrets are empty

- **Location:** [`infra/k8s/base/sealedsecret.yaml`](../infra/k8s/base/sealedsecret.yaml):9-10
- **Evidence:** `spec.encryptedData` is `{}` while workloads reference database, Kafka, Keycloak, storage, provider, and webhook secret keys. The production overlay also uses example public domains in [`infra/k8s/overlays/prod/configmap-env.yaml`](../infra/k8s/overlays/prod/configmap-env.yaml):9-18.
- **Risk:** Services cannot start with their required credentials, or a deployment may create an empty secret and fail later in confusing ways. This also makes the release artifact incomplete.
- **Remediation:** Generate the SealedSecret from the production secret manager, validate every `secretKeyRef` has a corresponding encrypted key, and block promotion when encrypted data is empty.

#### PR-002b - Production public origins are placeholders

- **Location:** [`infra/k8s/overlays/prod/configmap-env.yaml`](../infra/k8s/overlays/prod/configmap-env.yaml):9-18
- **Evidence:** `web.vnshop.example`, `api.vnshop.example`, `auth.vnshop.example`, and `storage.vnshop.example` are checked in as production values.
- **Risk:** OAuth callbacks, browser API calls, WebSocket origins, CORS, and object-storage URLs cannot work against a real deployment until the overlay is mutated externally. Treating this as a deployable production manifest invites an incomplete release.
- **Remediation:** Inject approved environment-specific origins through a production overlay or generated release artifact and reject `.example`/`.invalid` hosts in the production validator.

### HIGH

#### PR-003 - Production Kustomize retains stub/demo provider modes

- **Location:** [`infra/k8s/base/configmap.yaml`](../infra/k8s/base/configmap.yaml):53-60; [`infra/k8s/overlays/prod/configmap-env.yaml`](../infra/k8s/overlays/prod/configmap-env.yaml):1-18
- **Evidence:** The base sets `CARRIER_MODE=stub`, `VIETQR_MODE=demo`, and disables Stripe, PayPal, VNPay, MoMo, and SePay. The production overlay only replaces origins and does not replace these values.
- **Risk:** A production deployment can advertise or execute local/demo behavior for shipping and payments. This is a business correctness and operational incident risk, not merely a test limitation.
- **Remediation:** Make provider mode an explicit required production value, add a production policy check that rejects `stub`, `demo`, and unapproved `sandbox` modes, and set live carrier/payment credentials through the secret manager.

#### PR-004 - Central public configuration advertises stub/demo payment providers as enabled

- **Location:** [`services/configuration-service/src/configuration/configuration.service.ts`](../services/configuration-service/src/configuration/configuration.service.ts):157-176; [`services/configuration-service/config/services.yml`](../services/configuration-service/config/services.yml):26-36
- **Evidence:** The public provider projection always returns enabled COD in `stub` mode and enabled VietQR in `demo` mode. The central YAML also declares a stub carrier mode.
- **Risk:** Clients can present payment/shipping options that do not represent a real production capability, creating false-positive checkout availability and inconsistent backend/client policy.
- **Remediation:** Derive provider status from validated environment/provider configuration. In production, fail readiness or mark the provider disabled unless live credentials, endpoints, webhook verification, and settlement/reconciliation policy are present.

#### PR-005 - Silent local defaults allow services to start against localhost

- **Locations:** Representative examples: [`services/shipping-service/src/main/resources/application.yml`](../services/shipping-service/src/main/resources/application.yml):14-19, 37, 55, 69-77; [`services/order-service/src/main/resources/application-grpc.yml`](../services/order-service/src/main/resources/application-grpc.yml):4-11; [`services/payment-service/src/main/resources/application.yml`](../services/payment-service/src/main/resources/application.yml):13, 28, 61.
- **Evidence:** Database URLs, Kafka, Keycloak, gRPC hosts, and carrier mode use localhost or local service fallbacks when environment values are absent.
- **Risk:** A misconfigured server workload may start and repeatedly connect to itself/localhost instead of failing immediately. The failure appears later as timeouts, missing events, or partial data rather than a configuration error.
- **Remediation:** Keep local defaults in a named `local` profile only. Make server profiles require explicit endpoints and credentials with typed validation and a readiness failure. Add a test that boots each server profile with missing required values and expects failure.

#### PR-006 - FX conversion can use a hardcoded rate after the provider fails

- **Location:** [`services/payment-service/src/main/resources/application.yml`](../services/payment-service/src/main/resources/application.yml):118-125
- **Evidence:** `fallback-usd-to-vnd` defaults to `25500` and is applied when the FX adapter fails.
- **Risk:** A payment or refund can be converted using a stale fixed rate after an external outage. This creates an accounting discrepancy on a money path.
- **Remediation:** Make the fallback policy explicit per environment. For production, use an approved cached rate with age/variance limits and audit metadata, or fail the transaction and reconcile it asynchronously. Do not use an unbounded fixed default.

#### PR-007 - Configuration file load failure is downgraded to an empty configuration

- **Location:** [`services/configuration-service/src/configuration/configuration.service.ts`](../services/configuration-service/src/configuration/configuration.service.ts):25-39
- **Evidence:** A missing/unreadable YAML file is logged and replaced with empty maps; readiness only validates public origins at lines 121-123.
- **Risk:** A deployment can be marked ready while business configuration is absent. Individual service reads then fail later or use code defaults, making a configuration rollout partial and difficult to diagnose.
- **Remediation:** Fail startup/readiness when the required configuration file is missing or invalid. Validate a schema and required service keys before serving `/ready`.

#### PR-007b - Remote configuration arrives after conditional provider beans are built

- **Location:** `ConfigServiceClient` adapters in the order, payment, shipping, and invoice services; representative configuration is [`services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/config/ConfigServiceClient.java`](../services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/config/ConfigServiceClient.java):27-88.
- **Evidence:** The client runs as an `ApplicationRunner` and adds remote values late in the lifecycle. Conditional provider/carrier beans may already have been selected from local `application.yml` defaults before the remote configuration is applied.
- **Risk:** The repository has two configuration owners with unclear precedence. A configuration-service outage or late response can silently leave a provider in a local mode even though central YAML says otherwise.
- **Remediation:** Choose one startup configuration contract. Either load mandatory remote settings before context refresh, or remove the remote configuration dependency from conditional bean selection. Add precedence and outage tests.

#### PR-007c - Production Kafka is single-broker and SASL_PLAINTEXT

- **Location:** [`infra/k8s/base/platform-services.yaml`](../infra/k8s/base/platform-services.yaml):188-224; [`infra/k8s/base/configmap.yaml`](../infra/k8s/base/configmap.yaml):17.
- **Evidence:** Kubernetes runs one Kafka replica, replication factors and minimum ISR are one, and clients/broker use `SASL_PLAINTEXT`.
- **Risk:** A broker failure removes event availability and commerce events/credentials traverse the cluster without transport encryption. This undermines the outbox/saga reliability assumptions.
- **Remediation:** Use a production Kafka topology with multiple brokers and replication, require `SASL_SSL` or mTLS, and validate replica/ISR/TLS policy in the release gate.

#### PR-007d - Elasticsearch security is disabled and network egress is broad

- **Location:** [`infra/k8s/base/platform-services.yaml`](../infra/k8s/base/platform-services.yaml):315-325; [`infra/k8s/base/network-policies.yaml`](../infra/k8s/base/network-policies.yaml):30-57.
- **Evidence:** Elasticsearch sets `xpack.security.enabled=false`; the shared policy permits all VNShop pods to reach all pods and allows external HTTPS egress.
- **Risk:** A compromised application pod can read, alter, or delete the search data without Elasticsearch authentication. The broad egress also makes dependency boundaries harder to enforce.
- **Remediation:** Enable Elasticsearch security/TLS, inject credentials through the secret manager, restrict search access to the search service and approved operators, and add an authenticated readiness check.

### MEDIUM

#### PR-008 - Local staging Compose embeds weak credentials and localhost advertisement

- **Location:** [`infra/compose/staging/docker-compose.staging.yml`](../infra/compose/staging/docker-compose.staging.yml):12-13, 25, 67, 92-98, 167-409
- **Evidence:** The file uses `stub` modes, `vnshop123`, `admin/admin`, and `PLAINTEXT://localhost:9192`.
- **Risk:** The file is labeled local staging-like, so these are not automatically production credentials; however, the name and profile can cause accidental use as a shared staging environment and the Kafka advertised address is not portable across remote clients.
- **Remediation:** Rename it to make its local-only purpose unmistakable, source all credentials from an ignored env/secret file, use Docker DNS for in-network clients, and add a guard that rejects `NODE_ENV=production` with this Compose file.

#### PR-009 - Web and mobile clients have local fallback endpoints

- **Locations:** [`fe/src/app/lib/runtime-endpoints.ts`](../fe/src/app/lib/runtime-endpoints.ts):1-2; [`vnshop_mobile/lib/core/config/env_config.dart`](../vnshop_mobile/lib/core/config/env_config.dart):16-24, 48-68.
- **Evidence:** The web API defaults to `http://localhost:8080`; mobile continues after a missing `.env` and defaults to `host.docker.internal`/`localhost` endpoints.
- **Risk:** A production bundle or mobile build with missing injection can point to a developer machine or fail in a confusing way. The mobile loader also treats missing environment input as a recoverable condition.
- **Remediation:** Require build-time API/auth origins for release builds and fail the build when absent or non-HTTPS. Keep local defaults behind an explicit development build flag.

#### PR-010 - Carrier credentials are optional and webhook secrets fall back to API tokens

- **Location:** [`services/shipping-service/src/main/resources/application.yml`](../services/shipping-service/src/main/resources/application.yml):68-78
- **Evidence:** GHN/GHTK tokens and shop/partner identifiers default to empty, while webhook tokens inherit from provider API tokens when not set.
- **Risk:** Missing carrier identity can remain hidden until a live call; reusing an API token for webhook verification couples two security domains and weakens rotation/isolation.
- **Remediation:** Require independent webhook secrets in live mode, validate them at startup, and reject live mode when carrier identifiers or credentials are empty.

#### PR-011 - Invoice identity is placeholder business data

- **Location:** [`services/configuration-service/config/services.yml`](../services/configuration-service/config/services.yml):13-18
- **Evidence:** The seller tax code is `0123456789`, the address is a sample address, and phone is empty.
- **Risk:** Enabling invoice submission with placeholder identity can produce legally invalid invoices or route them to the wrong taxpayer.
- **Remediation:** Keep invoice submission disabled until real seller identity is injected from a protected, approved configuration source and validated before invoice generation/submission.

#### PR-012 - Legacy coupon deployment ownership is ambiguous

- **Location:** [`docker-compose.yml`](../docker-compose.yml):1079-1117 and [`README.md`](../README.md) service/deferred sections.
- **Evidence:** Documentation describes coupon-service as archived/not deployed, while the main Compose file still includes a buildable service block.
- **Risk:** Two teams or deployment paths can assume different owners for coupon rules and usage state, causing duplicate APIs or split data.
- **Remediation:** Choose one owner (order-service or coupon-service), remove the unused deployment path, and document the migration/compatibility contract.

#### PR-013 - Cursor HMAC keys have predictable source-controlled defaults

- **Locations:** [`services/product-service/src/main/java/com/vnshop/productservice/application/GetProductUseCase.java`](../services/product-service/src/main/java/com/vnshop/productservice/application/GetProductUseCase.java):52-55; [`services/search-service/src/main/java/com/vnshop/searchservice/application/SearchProductsUseCase.java`](../services/search-service/src/main/java/com/vnshop/searchservice/application/SearchProductsUseCase.java):19-22.
- **Evidence:** Both cursor codecs use `local-*-cursor-secret-change-me` when environment variables are absent, and no Kubernetes secret wiring for these keys was found.
- **Risk:** Anyone who can observe the source can forge signed cursors, defeating cursor integrity and potentially bypassing query-bound cursor assumptions.
- **Remediation:** Make cursor secrets mandatory validated configuration, inject them per environment, rotate them, and fail startup when they are absent outside tests.

#### PR-014 - CI bypasses carrier-mode coverage and release mobile configuration

- **Locations:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):339-340, 368, 409-415.
- **Evidence:** CI builds only a Flutter debug APK, excludes `CarrierModeSelectionTest`, and marks Node lint as `continue-on-error`.
- **Risk:** A production configuration regression can merge without exercising live/stub carrier selection, release endpoint injection, or lint correctness.
- **Remediation:** Add a release mobile build/configuration smoke test, restore carrier-mode tests to the required Java matrix, and remove `continue-on-error` after resolving the existing lint debt.

#### PR-015 - Local staging topology cannot validate gRPC/Kafka contracts remotely

- **Locations:** [`infra/compose/staging/docker-compose.staging.yml`](../infra/compose/staging/docker-compose.staging.yml):65-67, 345-368; [`services/order-service/src/main/resources/application-grpc.yml`](../services/order-service/src/main/resources/application-grpc.yml):3-11.
- **Evidence:** Kafka advertises `localhost:9192`, while the staging Compose order-service block does not provide the gRPC host overrides and the application defaults to localhost.
- **Risk:** Containers or remote staging clients can connect to the wrong network namespace. A green local process check does not prove the distributed contract works in a shared environment.
- **Remediation:** Use service DNS for in-network advertisements and inject all gRPC host/port values in the staging overlay. Add a rendered-Compose smoke test that resolves each dependency from inside the workload network.

## Code-owned closure backlog

The following items were verified by the 2026-07-22 source audit. They are separate from
PR-000 through PR-015 because they can be addressed primarily in repository code and tests.
They remain release blockers until their proof gates pass.

### CRITICAL / HIGH

#### PR-016 - Checkout gRPC path returns synthetic shipping labels

- **Location:** [`GrpcShippingServer`](../services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/grpc/GrpcShippingServer.java):67-82; [`GrpcShippingRequestAdapter`](../services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/grpc/GrpcShippingRequestAdapter.java):56-61.
- **Evidence:** The server contains a TODO for `CreateLabelCommand`, always returns success, generates random tracking codes, and the order adapter logs `success=false` without failing the saga.
- **Risk:** Orders can be marked shipping-complete without a provider shipment or usable carrier tracking code.
- **Status:** `in-progress`; the gRPC path now invokes `CreateLabelUseCase` and propagates carrier failure, but the shared shipping contract still lacks carrier-required contact, ward, district, province-code, parcel, and amount fields.
- **Proof gate:** A gRPC test must verify the configured carrier gateway is called and provider failure prevents `SHIPPING` completion.

#### PR-017 - Carrier webhook authentication is fail-open in default stub mode

- **Location:** [`GhnWebhookSignatureService`](../services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/webhook/GhnWebhookSignatureService.java):42-47; [`GhtkWebhookSignatureService`](../services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/webhook/GhtkWebhookSignatureService.java):45-51.
- **Evidence:** Missing webhook credentials accept blank signatures whenever `CARRIER_MODE` is not `live`; the default mode is `stub`.
- **Risk:** An unauthenticated caller can submit carrier status events in a default or misconfigured deployment.
- **Status:** `implemented`; missing credentials fail closed, and unsigned behavior requires an explicit local/dev opt-in.
- **Proof gate:** Real signature services and security-enabled MockMvc tests reject blank credentials; local stub tests opt in explicitly.

#### PR-018 - Payment callback outbox marks rows before Kafka acknowledgment

- **Location:** [`PaymentCallbackOutboxRelay`](../services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/event/PaymentCallbackOutboxRelay.java):86-92.
- **Evidence:** `send()` returns a future that is ignored, then `markPublished()` runs immediately.
- **Risk:** An asynchronous broker failure permanently loses `payment.completed`, leaving orders waiting for payment.
- **Status:** `implemented`; the relay waits for bounded Kafka acknowledgement before marking published.
- **Proof gate:** Exceptional and timed-out Kafka futures leave rows retryable; only an acknowledged send marks a row published.

#### PR-019 - Compensation event delivery has fire-and-forget paths

- **Location:** [`CancelShipmentUseCase`](../services/shipping-service/src/main/java/com/vnshop/shippingservice/application/CancelShipmentUseCase.java):20-24; [`ShippingEventPublisher`](../services/shipping-service/src/main/java/com/vnshop/shippingservice/infrastructure/event/ShippingEventPublisher.java):44-56; [`GrpcInventoryReservationAdapter`](../services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/grpc/GrpcInventoryReservationAdapter.java):117-124.
- **Evidence:** Shipping cancellation has a repository TODO and direct asynchronous Kafka publishing; inventory release fallback also sends without waiting or an outbox.
- **Risk:** Saga compensation can report success while refund/release/cancellation commands are lost.
- **Status:** `implemented-with-gap`; cancellation and inventory-release delivery now wait for acknowledgement, but shipment lookup/status persistence remains a repository TODO.
- **Proof gate:** Broker outage tests show compensation rows/events remain retryable and are not acknowledged early.

#### PR-020 - Product/search projection recovery is incomplete

- **Location:** [`ProductEventPublisher`](../services/product-service/src/main/java/com/vnshop/productservice/infrastructure/event/ProductEventPublisher.java):32-41; [`ProductEventConsumer`](../services/search-service/src/main/java/com/vnshop/searchservice/infrastructure/kafka/ProductEventConsumer.java):47-65.
- **Evidence:** Product lifecycle events are sent without a producer outbox. Elasticsearch failures are logged, then the Kafka event is marked processed.
- **Risk:** Product changes can commit without delivery, and Elasticsearch can remain stale without replay.
- **Status:** `implemented`; product lifecycle events use an outbox and Elasticsearch failures enter a repair queue.
- **Proof gate:** Product writes create a durable event row; Kafka/Elasticsearch failures retry or enter an explicit repair path.

#### PR-021 - Cart merge is not one atomic, reachable operation

- **Location:** [`CartController`](../services/cart-service/src/cart/infrastructure/cart.controller.ts):28-36; [`MergeCartUseCase`](../services/cart-service/src/cart/application/merge-cart.use-case.ts):34-40; [`use-cart.ts`](../fe/src/app/hooks/use-cart.ts):365-399.
- **Evidence:** The backend use case is registered but not injected into the controller; the web client replays item additions; backend save/delete run concurrently.
- **Risk:** Retries or browser crashes can duplicate quantities, and a partial merge can leave both carts inconsistent.
- **Status:** `implemented`; the authenticated merge endpoint is atomic and idempotent, with unit/frontend coverage. Full E2E still needs PostgreSQL/Redis.
- **Proof gate:** One consent-gated merge request is atomic and idempotent under retry, concurrency, and partial network failure.

#### PR-022 - Missing inventory projection is fail-open

- **Location:** [`ReserveStockUseCase`](../services/inventory-service/src/main/java/com/vnshop/inventoryservice/application/ReserveStockUseCase.java):62-68.
- **Evidence:** A missing stock row logs a warning and allows reservation without decrement.
- **Risk:** Checkout can proceed without reserving stock, creating oversell risk.
- **Status:** `implemented`; missing projected stock now rejects reservation instead of allowing checkout.
- **Proof gate:** Missing projection rejects checkout until an explicit product-to-inventory projection exists.

### MEDIUM

#### PR-023 - Notification retry and provider channels remain local/stub behavior

- **Location:** [`RetryFailedDeliveriesUseCase`](../services/notification-service/src/notification/application/command/retry-failed-deliveries.use-case.ts):29-34; email/SMS/push adapters under `services/notification-service/src/notification/infrastructure`.
- **Evidence:** The retry use case returns zero work as a placeholder; email, SMS, and push are disabled/no-op without credentials.
- **Risk:** Notifications may be persisted while external delivery never occurs or cannot be replayed operationally.
- **Status:** `implemented-with-external-provider`; retry/DLQ behavior is durable, while real email/SMS/push credentials remain external.
- **Proof gate:** A scheduled retry/DLQ path is tested, and staging has real channel credentials or an explicitly approved disabled-channel policy.

## Closure plan and external leftovers

The detailed execution order, file map, acceptance criteria, and verification matrix are in
[`PRODUCTION-READINESS-CLOSURE-PLAN.md`](PRODUCTION-READINESS-CLOSURE-PLAN.md).

Repository code can address PR-016 through PR-023. The following remain `blocked-external`
after those fixes until operational evidence is supplied: image digests, sealed secrets, public
origins, live carrier/payment credentials, independent webhook secrets, Kafka topology/TLS,
Elasticsearch security, FX policy, invoice identity, coupon ownership, shared staging DNS/gRPC
configuration, provider contract approval, and the missing carrier-required fields in the shipping
gRPC contract. These are not closed by unit tests or local Compose.

## 2026-07-22 execution evidence

The first closure implementation round completed the repository-owned durability, security, and
fallback-boundary work for PR-017, PR-018, PR-020, PR-021, PR-022, and PR-023. PR-019 is
acknowledgement-safe but still needs shipment lookup/status persistence. PR-016 no longer creates
synthetic tracking labels, but live carrier checkout remains blocked until the order-to-shipping
contract supplies contact, ward, district, province-code, parcel, and amount data.

Fresh focused evidence:

- Java: shipping 27 tests, order shipping/inventory adapter tests, payment outbox tests, inventory
  13 tests, product context/outbox tests, and search projection/repair tests passed.
- TypeScript/frontend: cart 25 tests plus typecheck, notification 27 suites/271 tests, and frontend
  cart 13 tests plus typecheck passed.
- Cart E2E now resolves the module graph but requires a live `DATABASE_URL` and PostgreSQL/Redis;
  it remains an environment-gated check rather than a source failure.

## Independent review synthesis

- **Code-reviewer lane:** `REQUEST CHANGES`, with 1 critical, 5 high, and 4 medium findings. The critical issue is the unsigned stub-mode carrier webhook path.
- **Architect lane:** `BLOCK`. It identified contradictory configuration owners, local provider modes in production, incomplete release artifacts/domains, single-broker plaintext Kafka, unsecured Elasticsearch, and broken staging distributed endpoints.
- **Final review recommendation:** `REQUEST CHANGES`. The repository has a strong implementation foundation, but the deployment contract and local fallback boundaries are not closed.

## Intentional local-only behavior

The following are acceptable for local development when they are isolated and labeled, but must not be
used as a production readiness signal:

| Behavior | Evidence | Production rule |
| --- | --- | --- |
| Guest cart in browser storage | `fe/src` guest-cart implementation | Keep as anonymous-user UX; server merge remains the source of authenticated cart truth. |
| Demo catalog seeding | `infra/scripts/seed-demo.mjs` | Never run against a production database. |
| Carrier stub pricing | `CARRIER_MODE=stub` in local Compose/env templates | Require explicit live mode in server overlays. |
| Payment sandbox/demo modes | `.env.example`, payment application config | Make provider state visible and block live checkout when not real. |
| Localhost/host Docker endpoints | service application files and mobile defaults | Restrict to local profile/build; fail closed in staging/prod. |

## Architectural lane result

**Status: BLOCK**

The architecture has coherent bounded contexts, ports/adapters, Kafka events, gRPC contracts, and
outbox/idempotency patterns. The blocker is the deployment contract: production manifests can still
select non-production provider behavior and do not yet contain deployable artifacts/secrets. The system
therefore cannot be considered production-ready solely because local E2E or unit tests pass.

## Required closure order

1. Replace all-zero image digests and validate them in CI.
2. Seal and validate every production secret reference.
3. Split local defaults from server profiles and add fail-fast configuration validation.
4. Make carrier/payment provider mode explicit and block stub/demo/sandbox in production.
5. Remove the fixed FX fallback from the money path or replace it with an approved bounded cached-rate policy.
6. Require independent webhook secrets and live carrier credentials.
7. Resolve coupon-service ownership and deployment ambiguity.
8. Add configuration-contract tests and a Kubernetes rendered-manifest production policy test.

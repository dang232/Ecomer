# VNShop Checkout Lifecycle Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unsafe checkout Tasks 1-2 with a durable, concurrency-safe
submission controller that sends at most one order request at a time,
reconciles an ambiguous order response without resubmitting it, and recovers
redirect payments by mapping gateway references back to the real order ID.

**Architecture:** `/payment/methods` is the configuration-aware capability
authority. Narrowly scoped backend prerequisites make Stripe and PayPal reuse
the payment row created with the order, derive provider creation idempotency
from the trusted internal payment ID, configure gateway returns to the browser
route, and expose buyer-owned read-only order-key reconciliation. Checkout then supports the
enabled intersection of `COD`, `VNPAY`, `MOMO`, `VIETQR`, `STRIPE`, and
`PAYPAL`. A controller, rather than a render-captured state value, owns the
state machine, immutable attempt snapshot, and shared in-flight promise.
Zod-validated session recovery is written before order placement and every
external payment transition. Redirect returns poll status with the recovered
order ID and never interpret a provider payment ID as an order ID.

**Tech Stack:** React 19, TypeScript strict mode, Zod 4, TanStack Query 5,
Vitest 4, Testing Library.

## Global Constraints

- This plan replaces Tasks 1-2 in
  `2026-07-29-web-commerce-modernization-02-checkout-boundaries.md`; do not
  execute those superseded tasks.
- Backend scope is limited to payment-service reuse/provider idempotency,
  database-serialized terminal promotion, provider deployment configuration,
  and buyer-owned read-only order-key reconciliation in Task 0. Do not change
  order creation semantics, callback semantics, or unrelated service
  contracts.
- `POST /orders` already creates the payment through order-service gRPC.
  Buyer-facing COD, VNPay, and MoMo calls reuse that payment through
  `PaymentController.processOrReuse`.
- `VIETQR` already reuses the order-owned payment. Stripe and PayPal may become
  selectable only after Task 0 proves their create endpoints do the same and
  their provider create requests are idempotent on the durable payment key.
- Discover capabilities from public `GET /payment/methods`; do not use the
  order-service's incomplete `/checkout/payment-methods` catalog.
- `BANK` is not an order-service payment enum. Remove it from canonical frontend
  types, fallbacks, fixtures, and UI.
- A concurrent submit call returns the same in-flight promise and cannot issue a
  second order or payment request.
- An ambiguous order response retains the exact immutable order identity and
  reconciles it through the buyer-owned lookup. It never automatically or
  manually resubmits `POST /orders`, because current synchronous downstream
  side effects are not atomically committed with the order row.
- Once an order ID exists, no retry calls `POST /orders`.
- Parse every recovery record and gateway parameter from `unknown`.
- Run the master plan Review Gate after every task.
- Do not stage or commit `fe/.ua/`.

---

### Task 0: Close Payment Replay, Return, And Order-Reconciliation Gaps

**Files:**
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/application/FindOrderByIdempotencyKeyUseCase.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/config/UseCaseConfig.java`
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/OrderController.java`
- Create: `services/order-service/src/test/java/com/vnshop/orderservice/application/FindOrderByIdempotencyKeyUseCaseTest.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/web/PaymentController.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/web/PaymentMethodsController.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/config/PaymentMethodValidator.java`
- Create: `services/payment-service/src/main/java/com/vnshop/paymentservice/application/ProviderInitializationService.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/application/PaymentPromotionService.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/domain/port/out/PaymentRepositoryPort.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/persistence/PaymentJpaSpringDataRepository.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/persistence/PaymentJpaRepository.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/stripe/StripeGateway.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/stripe/StripeIntentClient.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/stripe/DefaultStripeIntentClient.java`
- Modify: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/paypal/PayPalGateway.java`
- Modify: `services/payment-service/src/main/resources/application.yml`
- Modify: `docker-compose.yml`
- Modify: `secrets.env.local.example`
- Modify: `infra/k8s/base/configmap.yaml`
- Modify: `infra/k8s/base/workloads.yaml`
- Modify: `infra/k8s/overlays/staging/configmap-env.yaml`
- Modify: `infra/k8s/overlays/prod/configmap-env.yaml`
- Modify: `infra/k8s/SECRETS.md`
- Modify: `infra/scripts/validate-k8s-release.py`
- Test: `infra/scripts/test_validate_k8s_release.py`
- Create: `services/payment-service/src/test/java/com/vnshop/paymentservice/integration/PaymentPromotionConcurrencyIntegrationTest.java`
- Test: `services/payment-service/src/test/java/com/vnshop/paymentservice/infrastructure/web/PaymentControllerHeaderTest.java`
- Test: `services/payment-service/src/test/java/com/vnshop/paymentservice/infrastructure/stripe/StripeGatewayTest.java`
- Test: `services/payment-service/src/test/java/com/vnshop/paymentservice/infrastructure/paypal/PayPalGatewayTest.java`
- Test: `services/payment-service/src/test/java/com/vnshop/paymentservice/infrastructure/web/PaymentMethodsControllerContractTest.java`
- Test: `services/payment-service/src/test/java/com/vnshop/paymentservice/infrastructure/config/PaymentMethodValidatorTest.java`
- Create: `services/payment-service/src/test/java/com/vnshop/paymentservice/application/ProviderInitializationServiceTest.java`
- Create: `services/payment-service/src/test/java/com/vnshop/paymentservice/integration/ProviderInitializationConcurrencyIntegrationTest.java`
- Create: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/gateway/PaymentCallbackEventStore.java`
- Create: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/persistence/PaymentCallbackEventJpaEntity.java`
- Create: `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/persistence/PaymentCallbackEventSpringDataRepository.java`
- Create: `services/payment-service/src/main/resources/db/migration/V20__payment_callback_events.sql`
- Create: `services/payment-service/src/test/java/com/vnshop/paymentservice/integration/PaymentCallbackEventConcurrencyIntegrationTest.java`

**Interfaces:**
- Consumes: the payment row created by order-service gRPC, browser
  `Idempotency-Key`, Stripe idempotency keys, PayPal `PayPal-Request-Id`, and
  the existing order idempotency key.
- Produces: one internal payment row and one provider initialization per
  order/provider/internal-payment retry sequence, frontend return URLs for redirect
  providers, and authenticated read-only reconciliation at
  `GET /orders/by-idempotency-key/{key}`.

- [ ] **Step 1: Write failing reuse and provider-idempotency tests**

Extend controller tests to pre-populate an order-owned `STRIPE` or `PAYPAL`
payment, release two matching create calls together with different browser
payment keys, and prove:

- `ProcessPaymentUseCase.process` is never called;
- the winner references the existing internal `paymentId`; a concurrent loser
  may receive the provider's documented idempotency-in-progress, conflict, or
  temporary response and must converge through bounded reconciliation rather
  than being assumed to succeed immediately;
- a different buyer or method receives the same non-enumerating authorization
  failure used by `processOrReuse`;
- the provider client receives the same server-derived
  `create:<method>:<internalPaymentId>` key and byte-equivalent frozen amount,
  currency, and FX metadata for every attempt; and
- after the winner completes, the losing path's bounded sequential retry or
  provider lookup returns the one stored provider object without creating a
  second monetary identity.

Add a persistence-failure test in which the first provider create succeeds,
storing the provider reference fails, the FX source changes, and another pod
retries. The retry must use the original persisted FX snapshot and provider
key, retrieve or reconcile the original provider object, and store its
reference. Add a Testcontainers race proving two initializers with different
candidate rates persist one complete FX snapshot and send only that frozen
snapshot to provider creation.

Extend gateway tests to assert Stripe's `RequestOptions.idempotencyKey` and
PayPal's `PayPal-Request-Id` header equal the supplied server-derived key. Keep the
payment-method contract test locked so lowercase `cod`, `vietqr`, `stripe`,
`paypal`, `vnpay`, and `momo` appear only when their configuration is ready.
`sepay` may remain a separately discoverable provider capability, but the
frontend schema test proves it is not an order checkout method.

Use realistic PayPal capture fixtures. A representation response contains the
refund-safe capture ID under
`purchase_units[].payments.captures[].id`; a default minimal response may expose
only the top-level PayPal order ID. Tests require
`Prefer: return=representation`, nested capture-ID extraction, and a follow-up
order-detail lookup when capture returns a minimal body. The top-level order ID
must never be accepted or persisted as a capture ID. Cover both the complete
and minimal response shapes and prove the eventual refund request uses the
nested capture ID.

Add a failure-recovery test in which PayPal capture succeeds, a `RECEIVED`
callback event is appended, and transactional promotion rolls back before
payment, ledger, or outbox commit. On retry, a pre-existing event must not cause
an early return of the pending payment. The controller queries PayPal, recovers
the real capture ID, retries promotion, and ends with exactly one terminal
payment transition, one balanced ledger journal, one callback outbox row, and
one correlated `PROCESSED` event. Run the same scenario once with the
provider's minimal capture response so the follow-up order lookup is exercised.

Require exactly one nested `COMPLETED` capture before promotion. A top-level
completed order is not sufficient because PayPal can report a completed order
with a pending or declined nested payment. Keep a nested `PENDING` capture
reconcilable, reject `DECLINED` and `FAILED`, and test these statuses for both
representation and Show Order responses.

Make capability discovery fail closed on browser-required configuration:
VietQR requires account number and account name, Stripe requires publishable
key in addition to secret/webhook keys, and every other provider retains its
current complete credential checks. Mirror those checks in startup validation
so an enabled-but-incomplete provider cannot be advertised.

Add order-service tests proving `GET /orders/by-idempotency-key/{key}`:

- returns the already persisted order only when its `buyerId` equals the JWT
  buyer;
- returns the same non-enumerating not-found response for an unknown key or
  another buyer's key;
- performs no inventory, payment, shipping, coupon, or cart mutation;
- rejects blank or overlong keys before repository access.

Add configuration tests proving enabled VNPay and MoMo use frontend routes
`/payment/return/vnpay` and `/payment/return/momo`. The local default derives
from `VNSHOP_FRONTEND_URL=http://localhost:3000`; staging and production use
their existing HTTPS `VNSHOP_FRONTEND_URL` values. Keep IPN URLs on the payment
service. Do not accept a browser-supplied return URL.

Add `PaymentMethodValidatorTest` coverage for deployment profiles. Staging may
use sandbox/test provider endpoints only after deployment supplies a real
publicly resolvable HTTPS `VNSHOP_PUBLIC_API_URL`; `.invalid`, `.example`,
localhost, link-local, and private-address callback origins are rejected when
VNPay or MoMo is enabled. Production-enabled PayPal must use live mode;
production-enabled VNPay/MoMo must use reviewed HTTPS live endpoints; neither
profile may advertise a provider with localhost/private IPN URLs. A provider
flag remains false until its environment has real approved endpoints and
credentials.

Add rendered-manifest fixtures proving VietQR is false in base, staging, and
production unless `VIETQR_ACCOUNT_NO` and `VIETQR_ACCOUNT_NAME` are supplied
through `vnshop-runtime-secrets`. A local Compose fixture may enable VietQR
from `secrets.env.local`, but startup and `/payment/methods` must fail closed
when either account field is blank.

Add a Testcontainers-backed PostgreSQL integration test that saves one pending
payment, releases two real `PaymentPromotionService` bean calls together, and
asserts one `PENDING -> COMPLETED` transition, one balanced ledger journal, and
one callback outbox row. An in-memory repository test is not sufficient for
this invariant.

- [ ] **Step 2: Reuse the internal row and make provider creation retry-safe**

Change Stripe and PayPal controller initialization to call
`processOrReuse(orderId, method, paymentKey)`, never
`processPaymentUseCase.process` directly. Validate the browser key for request
shape and telemetry, but do not trust it as the external duplicate barrier.
After resolving the trusted internal payment, derive
`providerCreateKey = create:<lowercase-method>:<paymentId>` and pass it to:

- `StripeGateway.createPaymentIntent(payment, providerCreateKey)`, which puts it into
  Stripe `RequestOptions`;
- `PayPalGateway.createOrder(payment, providerCreateKey)`, which sends
  `PayPal-Request-Id`.

Move FX ownership out of the gateways and into
`ProviderInitializationService`. Resolve a candidate quote outside a database
transaction, then enter a short transaction that loads the payment with
`findByIdForUpdate`, persists a complete
`externalAmount`/`externalCurrency`/`fxRate`/`fxRateAt` snapshot only when none
exists, and returns the persisted snapshot. A racing caller discards its
candidate and uses the already persisted values. Every external create call
uses this frozen snapshot, so retrying the same provider key can never change
amount or FX metadata.

Keep provider calls outside database transactions. After provider creation,
persist the provider reference in a second short locked transaction before
responding. If that write fails, the durable FX snapshot remains. A retry uses
the same key and frozen request parameters, then retrieves or reconciles the
provider object before storing its reference. If the row already contains a
real Stripe intent or PayPal order reference, retrieve and return that object
without creating another one; add only the provider lookup needed for this
recovery. Retain the existing orphan/error telemetry.

Do not assume simultaneous PayPal calls using one `PayPal-Request-Id` both
succeed immediately. On an idempotency-in-progress, conflict, or temporary
response, the losing create path performs a small bounded sequential
reconciliation: re-read the locked internal row, then query PayPal by the
server-derived request identity or known order reference after the winner has
had time to persist it. Return the stored object when found; otherwise surface
a retryable response without changing the key or request body. Tests exercise
the loser error and later convergence explicitly.

Make PayPal capture money-idempotent under concurrent approval. Derive the
provider capture request ID from the trusted internal payment ID
(`capture:<paymentId>`), send it as `PayPal-Request-Id`, and keep promotion
idempotent when two callers race. The provider request key, not the current
check-then-call callback-log lookup, is the monetary duplicate barrier. A
losing capture that receives an in-progress/conflict/temporary response first
re-reads the locked internal payment and returns it when the winner already
completed. If the payment is still pending, query the PayPal order/capture;
when the provider confirms capture, promote it once under the payment-row lock.
Tests release two capture calls together, force the loser response, and prove
one PayPal capture identity, one terminal internal transition, and successful
bounded reconciliation.

Send `Prefer: return=representation` on PayPal capture and extract only the
nested capture ID from `purchase_units[].payments.captures[]`. If PayPal still
returns a minimal or idempotent body without that nested value, issue a bounded
Show Order Details lookup and extract it there. Reject missing or ambiguous
captures; delete the current fallback from top-level order `id` because refunds
require a capture ID, not an order ID.

Treat callback-log state as audit and reconciliation evidence, never as proof
that internal promotion committed. Keep the existing callback log immutable and
add an append-only callback-event stream for reconciliation. The new event store
writes a `RECEIVED` event with a stable correlation key derived from provider,
internal payment ID, and capture request ID; successful promotion appends
`PROCESSED` with the same key. No row is updated. A unique correlation/status
constraint and the locked payment transition make concurrent appends harmless.
On any retry, return early only when the locked payment is already terminal. If
the latest event is `RECEIVED` or an older `PROCESSED` event exists while the
payment remains pending, query PayPal with the stable request/order identity and
retry the same locked promotion path. Promotion rollback leaves no ledger or
outbox effects and remains recoverable. The Testcontainers event test proves
append-only correlation and one terminal outcome.

Add `findByIdForUpdate(UUID paymentId)` to `PaymentRepositoryPort` and implement
it in `PaymentJpaSpringDataRepository` with
`@Lock(LockModeType.PESSIMISTIC_WRITE)`. `PaymentPromotionService.promote`
loads the payment only through that method inside its existing transaction,
checks terminal state after the lock is acquired, and only then saves the
payment, ledger journal, and callback outbox row. The default in-memory port
implementation may delegate to `findById`, but the production JPA path must
serialize promotions by internal payment ID. Provider request idempotency
prevents duplicate external money movement; this row lock prevents duplicate
internal ledger/outbox effects.

Implement `FindOrderByIdempotencyKeyUseCase` over the existing
`OrderRepositoryPort.findByIdempotencyKey`. It checks buyer ownership before
returning the order and never invokes checkout. Wire the authenticated GET
route without changing `POST /orders`, its response, or its idempotency
behavior.

Set VNPay `return-url` and MoMo `redirect-url` from
`VNSHOP_FRONTEND_URL + /payment/return/<provider>` when an explicit provider
URL is absent. Add `VNSHOP_FRONTEND_URL` to the payment-service Compose
environment, correct the local example, and retain backend IPN/callback
verification as the authority for payment completion.

Map VNPay `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET` and MoMo
`MOMO_PARTNER_CODE`/`MOMO_ACCESS_KEY`/`MOMO_SECRET_KEY` into the payment-service
Compose environment. In Kubernetes, keep enable flags and
`VNSHOP_FRONTEND_URL` and the non-secret `VNSHOP_PUBLIC_API_URL` in
`vnshop-app-config`, but add explicit `vnshop-runtime-secrets` references for
VietQR account number/name plus VNPay, MoMo, Stripe, and PayPal credentials in
the payment-service workload. Document the exact sealed-secret keys in
`infra/k8s/SECRETS.md`; never put credential values or placeholders in the
ConfigMap. Render and validate both overlays with each provider enabled in a
controlled validation fixture so every advertised checkout method has a
deployable configuration path.

Mark optional-provider `secretKeyRef` entries `optional: true` so disabled
providers do not prevent the payment pod from starting. Refactor
`validate-k8s-release.py` to expose a pure required-secret-key collector: normal
secret references are always required; an optional provider reference becomes
required only when the rendered `vnshop-app-config` sets that provider's
`*_ENABLED` flag to `"true"`. `test_validate_k8s_release.py` renders synthetic
disabled/enabled provider fixtures and proves disabled optional keys are not
required, enabled provider keys are required, and missing enabled credentials
fail. VietQR specifically requires both `VIETQR_ACCOUNT_NO` and
`VIETQR_ACCOUNT_NAME` when enabled.

Change application and Compose defaults to `VIETQR_ENABLED=false`; the local
demo remains explicitly enableable by copying the documented values from
`secrets.env.local.example` into ignored `secrets.env.local`. Keep
`VIETQR_ENABLED=false` in base, staging, and production manifests until the
sealed account values exist. `PaymentMethodValidator` and
`/payment/methods` apply the same account-readiness rule so a broken transfer
target is never advertised.

Keep staging VNPay/MoMo flags false while its portfolio ingress uses
`.invalid`. To enable a staging sandbox, the deployment must replace
`VNSHOP_PUBLIC_API_URL` with a real public HTTPS API origin and derive
provider IPN URLs beneath it (or supply provider-specific URLs under the same
validated origin). Validation rejects reserved example TLDs, localhost,
link-local/private addresses, non-HTTPS origins, and mismatched callback
origins whenever either redirect provider is enabled. Set production
mode/endpoints/IPNs explicitly only from approved live-provider configuration
and a real production API origin; otherwise keep the provider flag false and
record the deployment gate rather than inventing a value.

- [ ] **Step 3: Verify, review, and commit**

Run the focused order-service prerequisite, then the payment-service suite:

```powershell
Push-Location services/order-service
.\mvnw.cmd -q -Dtest=FindOrderByIdempotencyKeyUseCaseTest test
.\mvnw.cmd -q test
Pop-Location
Push-Location services/payment-service
.\mvnw.cmd -q '-Dtest=PaymentControllerHeaderTest,StripeGatewayTest,PayPalGatewayTest,PaymentMethodsControllerContractTest,PaymentMethodValidatorTest,ProviderInitializationServiceTest,ProviderInitializationConcurrencyIntegrationTest,PaymentPromotionConcurrencyIntegrationTest' test
.\mvnw.cmd -q test
Pop-Location
python -m unittest infra/scripts/test_validate_k8s_release.py
python infra/scripts/validate-k8s-release.py --environment staging --allow-unsealed --allow-unresolved
python infra/scripts/validate-k8s-release.py --environment prod --allow-unsealed --allow-unresolved
```

Use the master Review Gate with special attention to replay, concurrent retry,
buyer ownership, and provider request-key evidence, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "fix(checkout): make payment recovery replay-safe"
```

---

### Task 1: Make Payment Capabilities And Wire Statuses Truthful

**Files:**
- Modify: `fe/src/app/lib/domain-enums.ts`
- Modify: `fe/src/app/types/api/checkout.ts`
- Modify: `fe/src/app/types/api/payment.ts`
- Test: `fe/src/app/types/api/payment.test.ts`
- Modify: `fe/src/app/lib/api/endpoints/checkout.ts`
- Modify: `fe/src/app/lib/api/endpoints/payment.ts`
- Modify: `fe/src/app/lib/api/endpoints/orders.ts`
- Test: `fe/src/app/lib/api/endpoints/orders.test.ts`
- Modify: `fe/src/app/pages/checkout/types.ts`
- Modify: `fe/src/app/pages/checkout/CheckoutPaymentStep.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutPaymentOptions.test.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutPage.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`

**Interfaces:**
- Consumes: `/payment/methods` and payment-service
  `PaymentStatus.name()`.
- Produces: `CheckoutProvider`, `CHECKOUT_IMPLEMENTED_METHODS`, complete payment
  status decoding, and a blocking unavailable state instead of invented
  fallback methods.

- [ ] **Step 1: Write failing capability and wire-contract tests**

Extend `CheckoutPaymentOptions.test.tsx` to prove:

```ts
it("keeps only enabled server-advertised flows implemented by checkout", () => {
  expect(
    toPaymentOptions([
      { id: "cod", name: "Cash", enabled: true },
      { id: "vnpay", name: "VNPay", enabled: true },
      { id: "momo", name: "MoMo", enabled: false },
      { id: "vietqr", name: "VietQR", enabled: true },
      { id: "stripe", name: "Stripe", enabled: true },
      { id: "paypal", name: "PayPal", enabled: true },
      { id: "sepay", name: "SePay", enabled: true },
      { id: "bank", name: "Bank", enabled: true },
    ]).map((option) => option.id),
  ).toEqual(["COD", "VNPAY", "VIETQR", "STRIPE", "PAYPAL"]);
});

it("does not invent payment methods when capability loading fails", () => {
  render(<CheckoutPaymentStep methods={undefined} loadError={new Error("offline")} />);
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.queryAllByRole("radio")).toHaveLength(0);
});
```

Add schema tests proving `paymentStatusSchema` accepts
`AWAITING_COLLECTION`, `PARTIALLY_REFUNDED`, `REFUNDED`, and
`PAYMENT_TIMEOUT`, while rejecting unknown status text.

- [ ] **Step 2: Remove BANK and define the implemented checkout intersection**

Delete `BANK` from `PAYMENT_METHODS`. In `checkout.ts`, keep the backend wire
parser forward-compatible but define:

```ts
export const checkoutProviderSchema = z.enum([
  "COD",
  "VNPAY",
  "MOMO",
  "VIETQR",
  "STRIPE",
  "PAYPAL",
]);
export type CheckoutProvider = z.infer<typeof checkoutProviderSchema>;

export const CHECKOUT_IMPLEMENTED_METHODS = [
  "COD",
  "VNPAY",
  "MOMO",
  "VIETQR",
  "STRIPE",
  "PAYPAL",
] as const satisfies readonly CheckoutProvider[];
```

Decode the `/payment/methods` envelope with Zod, uppercase each enabled `id`,
and validate it with `checkoutProviderSchema`. Unknown entries, provider-level
`sepay`, and legacy `BANK` are omitted and logged once in development. Do not
retain a fallback list. When the capability request errors or produces no
selectable methods, render a localized alert and retry button and disable order
submission.

Add `findOrderByIdempotencyKey(key)` to the order endpoint module. Decode the
normal `OrderResponse` envelope through the existing order schema, return a
typed not-found result for the endpoint's non-enumerating 404, and reject any
other error. Do not reconstruct an order from the list projection.

- [ ] **Step 3: Decode the real payment response**

In `payment.ts`, define the full current wire enum:

```ts
export const PAYMENT_STATUS_VALUES = [
  "PENDING",
  "AWAITING_COLLECTION",
  "COMPLETED",
  "FAILED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "PAYMENT_TIMEOUT",
] as const;
```

Replace `initiatePaymentSchema` with the actual `PaymentResponse` projection:
required `paymentId`, `orderId`, `amount`, `method`, `status`, nullable
`transactionRef`, nullable `redirectUrl`, and optional audit/FX fields. Infer
the endpoint result type from that schema. Assert COD
`AWAITING_COLLECTION` is a successful order-placement outcome, while redirect
flows require both `paymentId` and a valid `redirectUrl`.

Change VNPay and MoMo create bodies to `{ orderId }` only. Remove the ignored
frontend `returnUrl` property from endpoint types and calls; Task 0 owns the
server-configured browser return routes, so the client must not imply that it
can choose them per request.

- [ ] **Step 4: Verify, review, and commit**

Run from `fe`:

```powershell
pnpm exec vitest run src/app/pages/checkout/CheckoutPaymentOptions.test.tsx src/app/types/api/payment.test.ts src/app/lib/api/endpoints/orders.test.ts
pnpm run typecheck
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "fix(fe): align checkout payment capabilities"
```

### Task 2: Own Submission Concurrency And Immutable Retries

**Files:**
- Create: `fe/src/features/checkout/model/submission.ts`
- Create: `fe/src/features/checkout/model/submission.test.ts`
- Create: `fe/src/features/checkout/model/submission-controller.ts`
- Create: `fe/src/features/checkout/model/submission-controller.test.ts`
- Create: `fe/src/features/checkout/model/recovery.ts`
- Create: `fe/src/features/checkout/model/recovery.test.ts`
- Create: `fe/src/features/checkout/index.ts`

**Interfaces:**
- Consumes: `CheckoutProvider`, `PlaceOrderInput`, `placeOrder`,
  `findOrderByIdempotencyKey`, `codConfirm`, `vnpayCreate`, `momoCreate`,
  `vietqrCreate`, `stripeCreate`, `paypalCreate`, and `paypalCapture`.
- Produces: `CheckoutSubmissionState`, `checkoutSubmissionReducer`,
  `createCheckoutSubmissionController`, and Zod-validated
  `CheckoutRecoveryRecord`.

- [ ] **Step 1: Write failing reducer and recovery tests**

Model these states as a discriminated union:

```ts
type AttemptIdentity = {
  orderKey: string;
  cartFingerprint: string;
  provider: CheckoutProvider;
};

type CreatedOrder = AttemptIdentity & {
  paymentKey: string;
  orderId: string;
  total: number;
};

type InitializedPayment = CreatedOrder & {
  paymentId: string;
  providerState:
    | { kind: "cod" }
    | { kind: "redirect"; redirectUrl: string }
    | { kind: "vietqr"; qrImageUrl: string; reference: string }
    | { kind: "stripe"; publishableKey: string; clientSecret: string; intentId: string }
    | { kind: "paypal"; clientId: string; paypalOrderId: string };
};

export type CheckoutSubmissionState =
  | { status: "draft"; orderKey: string; cartFingerprint: string }
  | ({ status: "placing" } & AttemptIdentity)
  | ({ status: "order-created" } & CreatedOrder)
  | ({ status: "payment-initializing" } & CreatedOrder)
  | ({ status: "pending" } & InitializedPayment)
  | ({ status: "completed" } & InitializedPayment)
  | ({ status: "reconciling"; startedAt: number } & AttemptIdentity)
  | ({ status: "uncertain"; message: string } & AttemptIdentity)
  | ({
      status: "failed";
      stage: "payment";
      message: string;
      paymentId?: string;
    } & CreatedOrder);
```

Tests prove invalid events are no-ops, payment failures retain every identity
field, and no state that owns `orderId` can transition back to order placement.

Define a versioned Zod `CheckoutRecoveryRecord` union:

```ts
const orderRecoverySchema = z.object({
  version: z.literal(1),
  phase: z.literal("order"),
  orderKey: z.string().uuid(),
  cartFingerprint: z.string(),
  provider: checkoutProviderSchema,
  order: placeOrderInputSchema,
});

const paymentRecoverySchema = z.object({
  version: z.literal(1),
  phase: z.literal("redirect"),
  orderKey: z.string().uuid(),
  paymentKey: z.string().uuid(),
  orderId: z.string().min(1),
  paymentId: z.string().uuid(),
  total: z.number().nonnegative(),
  provider: z.enum(["VNPAY", "MOMO"]),
});
```

Add a `phase: "created"` member between these two records with `orderKey`,
`paymentKey`, `orderId`, `total`, and any `CheckoutProvider`, but no required
payment ID. Persist it immediately after `POST /orders` returns and before the
first provider call. Hydrating this phase resumes payment initialization and can
never place the order again.

Hydrating `phase: "order"` starts read-only reconciliation, not
`POST /orders`. Persist a reconciliation deadline/attempt count so reload does
not reset the bound forever. When the lookup remains not-found, transition to
the explicit uncertain record and require the buyer to inspect Orders before
local abandonment.

Add provider-state recovery members for VietQR, Stripe, and PayPal. Persist only
the order/payment keys, IDs, provider reference, and nonsecret display fields;
do not persist Stripe `clientSecret`. A reload from Stripe's created phase calls
`stripeCreate` again with the same payment key to retrieve the same intent and
fresh client secret. A PayPal/VietQR reload follows the same payment-only rule
and never calls `POST /orders`.

Malformed, wrong-version, and mismatched records return `null` and are removed
from `sessionStorage`.

- [ ] **Step 2: Write failing controller invariants**

Create `submission-controller.test.ts` with these required cases:

```ts
it("shares one promise and sends one POST for concurrent submit calls", async () => {
  const gate = deferred<{ id: string; total: number }>();
  const placeOrder = vi.fn(() => gate.promise);
  const controller = createCheckoutSubmissionController(dependencies({ placeOrder }));

  const first = controller.submit(input);
  const second = controller.submit(input);

  expect(first).toBe(second);
  expect(placeOrder).toHaveBeenCalledTimes(1);
  gate.resolve({ id: "order-1", total: 125_000 });
  await Promise.all([first, second]);
  expect(placeOrder).toHaveBeenCalledTimes(1);
});
```

Also prove:

- a payment initialization failure followed by retry calls `placeOrder` once
  and the provider endpoint twice with one payment key;
- an ambiguous order response performs bounded
  `findOrderByIdempotencyKey(orderKey)` calls and never calls `placeOrder`
  again;
- reconciliation that finds the order resumes only payment initialization with
  the recovered order ID;
- reconciliation that remains not-found reaches `uncertain`, keeps "View
  orders" and support actions, and exposes no order-resubmit command;
- changing the cart while placement is in flight never changes that body/key;
- after the original attempt resolves, the next draft uses a new key and the
  latest cart fingerprint;
- a state that owns an order ignores all order-placement calls;
- synchronous double click, Enter plus click, and React rerender all share the
  same promise.

- [ ] **Step 3: Implement the mutable controller**

Expose this public shape:

```ts
export interface CheckoutSubmissionController {
  getState(): CheckoutSubmissionState;
  subscribe(listener: (state: CheckoutSubmissionState) => void): () => void;
  updateCartFingerprint(fingerprint: string): void;
  submit(input: CheckoutSubmissionInput): Promise<CheckoutSubmissionResult>;
}
```

`submit` must be a non-`async` method so a concurrent caller receives the exact
same promise object. Its algorithm is:

1. Return `inFlight` immediately when it is non-null.
2. If no attempt exists, clone and validate `input.order`, capture provider,
   fingerprint, and current order key, then persist `phase: "order"` before
   calling `placeOrder`.
3. If placement rejects after dispatch or its response is otherwise ambiguous,
   enter `reconciling` and poll the read-only order-key endpoint with capped
   exponential backoff. If it finds the order, continue at `phase: "created"`.
   If the bound expires, enter `uncertain`; never call `placeOrder` again for
   that attempt.
4. Assign the promise to `inFlight` synchronously before returning it.
5. On order success, create one payment key and persist `phase: "created"`
   synchronously before resolving the existing payment through the provider
   call. This closes the reload window between order creation and payment
   initialization.
6. Dispatch through an exhaustive `Record<CheckoutProvider, ProviderAdapter>`;
   no default branch or cast is allowed.
7. COD calls `codConfirm` and treats `AWAITING_COLLECTION` or `COMPLETED` as
   checkout completion.
8. VNPay/MoMo require a payment ID and redirect URL, then persist
   `phase: "redirect"` before navigation.
9. VietQR requires a payment ID, QR URL, account/reference fields, and enters an
   in-page pending state that polls the real order ID.
10. Stripe requires the existing payment ID, publishable key, client secret,
    and intent ID before mounting Elements. PayPal requires the existing payment
    ID, client ID, and PayPal order ID before mounting Smart Buttons; capture
    uses those exact recovered IDs. Both retries reuse the same payment key.
11. In `finally`, clear `inFlight`. If the attempt is `uncertain`, keep its
   identity and safety actions visible across rerenders/reloads. A buyer may
   explicitly abandon the local draft only after visiting Orders; abandonment
   clears local recovery but does not silently submit the changed cart.

Use a `Set` of listeners and one `transition` function to keep reducer state,
session recovery, and React subscribers synchronized. Do not expose the pure
attempt runner as a second public API that callers can invoke concurrently.

- [ ] **Step 4: Verify, review, and commit**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/checkout/model/submission.test.ts src/features/checkout/model/submission-controller.test.ts src/features/checkout/model/recovery.test.ts
pnpm run typecheck
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "fix(fe): serialize durable checkout submission"
```

### Task 3: Integrate Durable Redirect And Return Recovery

**Files:**
- Modify: `fe/src/app/pages/checkout/CheckoutPage.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutReviewStep.tsx`
- Create: `fe/src/app/pages/checkout/CheckoutPaymentRecovery.tsx`
- Modify: `fe/src/app/components/checkout/StripePaymentSection.tsx`
- Modify: `fe/src/app/components/checkout/PayPalPaymentSection.tsx`
- Modify: `fe/src/app/components/checkout/VietQrPaymentSection.tsx`
- Modify: `fe/src/app/pages/PaymentReturnPage.tsx`
- Modify: `fe/src/app/pages/PaymentReturnPage.test.tsx`
- Create: `fe/src/app/pages/checkout/CheckoutPage.test.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`

**Interfaces:**
- Consumes: the controller and recovery store from Task 2.
- Produces: one controller per mounted checkout, order-only/payment-only
  recovery surfaces, and provider return validation against the stored payment
  identity.

- [ ] **Step 1: Mount one controller and subscribe with React**

Create the controller once in a ref. Subscribe with `useSyncExternalStore`
instead of copying a render-captured state into callbacks:

```ts
const controllerRef = useRef<CheckoutSubmissionController>();
if (!controllerRef.current) {
  controllerRef.current = createCheckoutSubmissionController(checkoutDependencies);
}
const controller = controllerRef.current;
const submission = useSyncExternalStore(
  controller.subscribe,
  controller.getState,
  controller.getState,
);
```

If the local React types require an initial ref value, use
`useRef<CheckoutSubmissionController | null>(null)` and a typed local guard; do
not assert non-null. Memoize dependency functions or inject mutable dependency
refs so the controller always calls current auth/API functions without being
recreated.

Derive the cart fingerprint from sorted product ID, variant ID, and quantity,
then call `controller.updateCartFingerprint` in an effect. `handlePlaceOrder`
calls only `controller.submit(currentInput)`. Disable every order/payment action
for placing or payment-initializing states. The controller, not the disabled
button, remains the duplicate-request guarantee.

- [ ] **Step 2: Make failure recovery explicit**

`CheckoutPaymentRecovery` renders:

- order-stage reconciliation: explain that VNShop is checking whether the
  original request completed, show the captured cart summary, and expose no
  submit command;
- uncertain order outcome: show "View orders" and support access, explain that
  checkout will not resubmit automatically, and allow explicit local
  abandonment only after the Orders link has been activated;
- payment-stage failure: state that the order already exists, display its ID,
  and provide "Retry payment" plus "View order";
- pending redirect state: show "Continue payment" only when the persisted
  provider URL is still available in memory; otherwise direct the buyer to
  orders and do not create another order.
- VietQR/Stripe/PayPal payment state: resume provider initialization with the
  stored order/payment identity and same payment key, then render the typed
  in-page provider component. Never recreate the order.

Cart editing may continue visually, but a changed cart does not alter the
recovery attempt. A new cart attempt becomes available only after the original
attempt reaches a known result.

- [ ] **Step 3: Persist before redirect and validate provider return**

Before `window.location.assign`, assert the controller state is `pending` and
the payment recovery record is already in `sessionStorage`.

In `PaymentReturnPage`:

1. Validate `params.provider` with `z.enum(["vnpay", "momo"])`; do not default
   unknown providers to VNPay.
2. Read and decode the payment recovery record.
3. Read the provider payment reference from `vnp_TxnRef` for VNPay and
   `orderId`/`requestId` for MoMo.
4. Require the recovered provider to match the route and, when a gateway
   reference is present, require it to match recovered `paymentId`.
5. Poll `paymentStatus(recovery.orderId)`. Never pass the provider payment ID
   to `/payment/status/{orderId}`.
6. Treat `COMPLETED` as success; `FAILED` and `PAYMENT_TIMEOUT` as failure; and
   continue bounded polling only for `PENDING`.
7. Clear recovery after a terminal result. If recovery is missing or mismatched,
   show a localized recoverable error and link to `/orders`; do not poll a
   guessed identifier.

Amount comes from the trusted recovery record/status response, not an
unvalidated gateway query parameter.

- [ ] **Step 4: Add integration regressions**

`CheckoutPage.test.tsx` must:

- invoke the submit handler twice before the first promise resolves and assert
  one `placeOrder` request;
- rerender between calls and retain the same assertion;
- fail then retry payment and assert one order/two payment calls;
- change the cart while order placement is unresolved, reject the request,
  reconcile by key, and assert no second order request;
- recover a persisted order from reconciliation and assert payment starts for
  that order only;
- exhaust not-found reconciliation and assert the uncertain UI contains no
  order retry action;
- prove session recovery is written before `location.assign`;
- prove COD `AWAITING_COLLECTION` reaches success without another order call;
- table-test all six provider adapters and assert each calls only its matching
  endpoint with the same order ID/payment key;
- retry VietQR, Stripe, and PayPal initialization after rerender/reload and
  assert one order, one internal payment ID, and stable provider identity;
- double-approve PayPal and prove one idempotent capture result.

`PaymentReturnPage.test.tsx` must:

- map a VNPay payment reference to the recovered order ID used for polling;
- reject provider/reference mismatch without calling `paymentStatus`;
- reject missing/malformed recovery without guessing an order ID;
- stop polling and clear storage on completed, failed, and timeout results.

- [ ] **Step 5: Verify, review, and commit**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/checkout src/app/pages/checkout/CheckoutPage.test.tsx src/app/pages/PaymentReturnPage.test.tsx
pnpm run typecheck
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use Playwright request counting to double-activate the review command and prove
one `POST /orders`. Exercise one redirect return with a captured recovery record
and assert `/payment/status/<real-order-id>`.

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "fix(fe): recover checkout redirects safely"
```

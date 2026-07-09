# Backend Contract Audit - VNShop Flutter Phase 0

Member: A `backend-contract-audit`
Date: 2026-07-08

## Executive Summary

The backend supports authenticated order checkout through `POST /orders` and several payment creation flows, but it does not expose the Flutter-requested payment contract as stated:

- `POST /orders` exists at the gateway and requires `Idempotency-Key`.
- `POST /payments/initiate` was not found. Current payment create routes are singular and method-specific under `/payment/**`.
- `GET /payments/{transactionId}/status` was not found. Current buyer status route is `GET /payment/status/{orderId}`.
- Gateway routes `/orders/**` and `/payment/**`, but not `/payments/**`.
- Gateway `/v3/api-docs` readiness is not proven: gateway has only `springdoc.swagger-ui.path` config and no `springdoc-openapi` dependency found in its `pom.xml`; order/payment service configs use `/api-docs` internally.
- VietQR expiry is implemented by a scheduled job; no generic transaction-expiry status endpoint was found.

## Endpoint Evidence

### `POST /orders`

Status: Ready with required client header.

Evidence:

- Controller route: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/OrderController.java:30-56` declares `@RequestMapping("/orders")`, `@PostMapping`, auth, and `@RequestHeader(name = "Idempotency-Key")`.
- Request body: `CheckoutRequest` requires `shippingAddress`, non-empty `items`, and `paymentMethod` at `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/CheckoutRequest.java:11-14`.
- Response body: `OrderResponse` returns `id`, `orderNumber`, `buyerId`, `shippingAddress`, `subOrders`, totals, `paymentMethod`, `paymentStatus`, and `idempotencyKey` at `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/OrderResponse.java:7-20`.
- Gateway exposure: `services/api-gateway/src/main/java/com/vnshop/apigateway/infrastructure/route/RouteConfig.java:163-165` routes `/orders/**` to order-service with rate limiting.

Idempotency behavior:

- `OrderController` requires the header before calling checkout (`OrderController.java:55-62`).
- `CreateOrderUseCase` rejects blank idempotency keys and returns an existing order when the same key is found (`services/order-service/src/main/java/com/vnshop/orderservice/application/CreateOrderUseCase.java:67-76`).
- Persistence has a unique `idempotency_key` column (`services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/persistence/OrderJpaEntity.java:83-84`).

Flutter note:

- Generate an idempotency key per checkout attempt and send it as the `Idempotency-Key` header.
- The same key should only be retried for the same user intent/request; backend order idempotency is keyed by header only, not by a stored request hash.

### `POST /payments/initiate`

Status: Not ready as specified.

No `payments/initiate` route was found in `services/payment-service`, `services/api-gateway`, or `docker-compose.yml`.

Current payment create routes:

- Base controller: `PaymentController` uses `@RequestMapping("/payment")` at `services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/web/PaymentController.java:37-39`.
- COD: `POST /payment/cod/confirm` (`PaymentController.java:76-82`).
- VNPay: `POST /payment/vnpay/create` (`PaymentController.java:85-91`).
- MoMo: `POST /payment/momo/create` (`PaymentController.java:106-112`).
- VietQR: `POST /payment/vietqr/create` (`PaymentController.java:129-148`).
- PayPal: `POST /payment/paypal/create` (`PaymentController.java:158-184`), then capture via `POST /payment/paypal/capture/{paymentId}/{paypalOrderId}` (`PaymentController.java:199-252`).
- Stripe: `POST /payment/stripe/create` (`PaymentController.java:288-307`).

Request/response shape:

- `PaymentRequest` accepts only `orderId`; buyer and amount are resolved server-side (`services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/web/PaymentRequest.java:5-14`).
- `PaymentResponse` returns `paymentId`, `orderId`, `buyerId`, `amount`, `method`, `status`, `transactionRef`, `redirectUrl`, timestamps, and FX fields (`services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/web/PaymentResponse.java:25-39`).
- VNPay/MoMo redirect URLs are surfaced as `redirectUrl` only while status is `PENDING` (`PaymentResponse.java:58-70`).

Gateway exposure:

- `services/api-gateway/src/main/java/com/vnshop/apigateway/infrastructure/route/RouteConfig.java:166-168` routes `/payment/**`, not `/payments/**`.
- `GET /api/v1/payments/methods` exists only for method metadata (`services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/web/PaymentMethodsController.java:25-66`).

Flutter impact:

- A Flutter API client targeting `POST /payments/initiate` will 404 through the gateway unless a compatibility route/controller is added.
- Current client contract must branch by selected payment method and call `/payment/{method}/...`.

### `GET /payments/{transactionId}/status`

Status: Not ready as specified.

No `GET /payments/{transactionId}/status` route was found.

Current buyer-visible status route:

- `GET /payment/status/{orderId}` is authenticated and returns the payment row for the caller's order (`services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/web/PaymentController.java:270-279`).
- The use case looks up by `orderId`, not `transactionId`, and verifies `buyerId` against the JWT principal (`services/payment-service/src/main/java/com/vnshop/paymentservice/application/GetPaymentStatusUseCase.java:36-42`).

Status-query caveat:

- `CompositePaymentGateway#getStatus` currently returns `PENDING` unconditionally (`services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/gateway/CompositePaymentGateway.java:55-58`), so provider-side transaction polling is not wired through that port.
- Buyer HTTP status reads the persisted payment row, not live provider state.

Flutter impact:

- Mobile polling should use `orderId` with `/payment/status/{orderId}` if consuming current backend.
- If the mobile spec requires transaction-id polling, backend needs a new route and repository lookup by payment id/transaction reference.

## Expiry / Timeout Behavior

Status: Partially ready for VietQR.

Evidence:

- VietQR timeout config defaults to 10 minutes and checks every 60 seconds (`services/payment-service/src/main/resources/application.yml:137-141`).
- `VietQrTimeoutJob` is enabled when `payment.vietqr.enabled=true` or missing, runs on `@Scheduled(fixedRateString = "${payment.vietqr.timeout-check-interval-seconds:60}000")`, and marks stale `PENDING` VietQR payments as `PAYMENT_TIMEOUT` (`services/payment-service/src/main/java/com/vnshop/paymentservice/infrastructure/gateway/VietQrTimeoutJob.java:32-64`).
- VNPay includes provider-side `expire-minutes` default 15 (`services/payment-service/src/main/resources/application.yml:96-105`), but I did not find a backend scheduled job that transitions stale VNPay/MoMo payments to a terminal timeout status.

## Docker / Gateway Exposure

Status: Gateway-only public access mostly matches project convention.

Evidence:

- `api-gateway` publishes `8080:8080` (`docker-compose.yml:675-700`).
- `order-service` internal port mapping is commented out and listens on 8091 (`docker-compose.yml:1169-1227`).
- `payment-service` internal port mapping is commented out and listens on 8092 (`docker-compose.yml:1232-1301`).
- Gateway service URIs target `order-service:8091` and `payment-service:8092` by default (`services/api-gateway/src/main/java/com/vnshop/apigateway/infrastructure/route/RouteConfig.java:56-57`).

Payment flags in compose:

- COD and VietQR default enabled; VNPay, MoMo, Stripe, and PayPal default disabled (`docker-compose.yml:1261-1268`).
- VietQR account number/name default empty, so runtime readiness depends on validation/config behavior outside this route audit (`docker-compose.yml:1269-1274`).

## OpenAPI / `/v3/api-docs` Readiness

Status: Not ready/proven at gateway.

Evidence:

- Gateway config only sets `springdoc.swagger-ui.path: /swagger-ui.html`; it does not set `springdoc.api-docs.path` or downstream grouped URLs (`services/api-gateway/src/main/resources/application.yml:35-37`).
- Gateway `pom.xml` search found no `org.springdoc` / `springdoc-openapi` dependency in `services/api-gateway/pom.xml`.
- Order service config declares docs at `/api-docs` (`services/order-service/src/main/resources/application.yml:81-85`).
- Payment service config declares docs at `/api-docs` (`services/payment-service/src/main/resources/application.yml:148-152`).
- Gateway routes do not include `/api-docs`, `/v3/api-docs`, or service-specific docs proxy routes in `RouteConfig.java:93-238`.

Flutter impact:

- Do not assume `http://localhost:8080/v3/api-docs` can generate a mobile client for order/payment.
- If OpenAPI-driven Flutter generation is required, add/verify gateway OpenAPI aggregation or fetch service docs from inside the Docker network.

## Recommended Backend Contract Actions

1. Decide whether Flutter should consume current backend routes or whether backend will add mobile-friendly compatibility routes.
2. If keeping current routes, document these client paths:
   - `POST /orders`
   - `GET /payment/status/{orderId}`
   - `POST /payment/cod/confirm`
   - `POST /payment/vnpay/create`
   - `POST /payment/momo/create`
   - `POST /payment/vietqr/create`
   - `POST /payment/stripe/create`
   - `POST /payment/paypal/create`
   - `POST /payment/paypal/capture/{paymentId}/{paypalOrderId}`
   - `GET /api/v1/payments/methods`
3. If matching the Flutter requirement, add gateway-backed plural compatibility endpoints:
   - `POST /payments/initiate`
   - `GET /payments/{transactionId}/status`
4. Add gateway OpenAPI aggregation or a documented docs generation path before relying on `/v3/api-docs`.

## Verification Performed

- Used codegraph to inspect current controller/use-case source for order checkout, payment create/status, idempotency, and VietQR timeout behavior.
- Used `rg` to search scoped files for `payments/initiate`, `/payments`, `transactionId`, status, OpenAPI, and scheduled expiry terms.
- Used line-numbered config reads for gateway, docker compose, order service, and payment service exposure.
- No product code was edited.

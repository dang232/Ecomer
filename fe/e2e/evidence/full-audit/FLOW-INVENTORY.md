# VNShop Full-Stack Flow Inventory

Generated during the 2026-07-22 local Docker audit. This is the map used to decide which browser and API flows require evidence.

## Frontend Route Map

The React router is defined in `fe/src/app/routes.ts`. The storefront uses `/search`, not `/products`; `/products` is an API resource used by the journey setup and is not a browser route.

| Route                        | Persona              | Workflow covered                                                                                    |
| ---------------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| `/`                          | Guest, buyer         | Announcement, catalog, categories, trending products, seller showcase, trust bar, language, theme   |
| `/search`                    | Guest, buyer         | Query, category, sort, price validation, clear filters, product cards                               |
| `/product/:id`               | Guest, buyer         | Gallery, variants, quantity, add-to-cart, buy-now, wishlist, seller link, reviews                   |
| `/cart`                      | Guest, buyer         | Guest local cart, authenticated server cart, quantity, removal, totals, coupon entry                |
| `/checkout`                  | Buyer                | Address, shipping, payment, review, COD placement, gateway handoff, success                         |
| `/orders`                    | Buyer                | Order history, status filters, cancellation, review/return entry points                             |
| `/orders/:id`                | Buyer                | Order detail, payment, fulfillment status, return/review actions                                    |
| `/returns`                   | Buyer                | Return status list and dispute/return state                                                         |
| `/returns/new`               | Buyer                | Return request creation                                                                             |
| `/profile`                   | Buyer                | Personal data, address CRUD, avatar upload, preferences                                             |
| `/wishlist`                  | Buyer                | Saved products, remove, add-to-cart                                                                 |
| `/messages`                  | Buyer                | Authenticated messaging shell and thread composer                                                   |
| `/notifications`             | Buyer                | Notification list, read, mark-all-read                                                              |
| `/notifications/preferences` | Buyer                | Notification preference controls                                                                    |
| `/login`                     | Guest                | OIDC entry, Keycloak login, invalid credentials                                                     |
| `/register`                  | Guest                | Registration and OIDC completion                                                                    |
| `/password-reset`            | Guest                | Reset request and confirmation                                                                      |
| `/seller/*`                  | Seller               | Dashboard, products, orders, reviews, wallet, settings, video upload                                |
| `/admin/*`                   | Admin                | Dashboard, sellers, moderation, video moderation, coupons, disputes, payouts, users, orders, health |
| `/sellers/:id`               | Guest, buyer, seller | Public seller profile and product listing                                                           |
| `/payment/return/:provider`  | Buyer                | Provider return error/completion shell                                                              |
| `/design-system`             | Guest                | Design-system reference page                                                                        |
| `/access-denied` and `*`     | Any                  | Role denial and not-found boundaries                                                                |

## Backend Service Map

Traffic is intended to enter through `http://localhost:8080`; internal ports are not public application contracts.

| Service                   |     Port | Responsibility and flow boundary                                                              |
| ------------------------- | -------: | --------------------------------------------------------------------------------------------- |
| `api-gateway`             |     8080 | OAuth2/cookie handling, routing, CORS, rate limits, public entry point                        |
| `user-service`            |     8081 | Buyer/seller profiles, addresses, wishlist, avatar, roles, wallet view                        |
| `product-service`         |     8082 | Catalog, product detail, variants, seller ownership, image activation, product outbox         |
| `inventory-service`       |     8083 | Stock reservation/release and inventory gRPC boundary                                         |
| `cart-service`            |     8084 | Authenticated cart lines, totals, additive guest merge, idempotent mutations                  |
| `search-service`          |     8086 | Elasticsearch product projection, query, category/brand/price facets                          |
| `notification-service`    |     8087 | In-app notification persistence, unread count, read/mark-all, delivery adapters               |
| `coupon-service`          |     8088 | Coupon validation, active catalogue, admin CRUD and deactivation                              |
| `recommendations-service` |     8094 | Recommendation/read-model surface used by storefront features                                 |
| `messaging-service`       |     8095 | Buyer messaging threads and messages                                                          |
| `monitoring-service-v2`   |     8096 | Operational monitoring and health aggregation                                                 |
| `configuration-service`   |     8097 | Centralized runtime/configuration values                                                      |
| `invoice-service`         |     8098 | Invoice generation and invoice read path                                                      |
| `order-service`           |     8091 | Order write model, idempotency, status transitions, seller queue, order events                |
| `payment-service`         |     8092 | COD/VietQR/SePay live paths, sandbox/disabled provider adapters, callbacks and reconciliation |
| `shipping-service`        |     8093 | GHN/GHTK adapters, label/quote flow, signed webhooks, shipping outbox                         |
| `seller-finance-service`  |     8090 | Seller earnings, available/pending wallet, payout request/completion and audit                |
| `video-transcoder`        | internal | FFmpeg upload/transcode pipeline and object-storage output                                    |
| `video-moderator`         | internal | Video moderation inference, moderation status and appeals                                     |

## Business Journey Sequence

1. Guest loads `/`, searches `/search`, opens `/product/:id`, and may keep a guest cart in browser storage.
2. Buyer registers through OIDC, authenticates, and explicitly chooses whether guest items merge into the server cart.
3. Buyer adds an address, selects shipping/payment, validates a coupon, and places a COD order through the gateway.
4. Order service persists the order and publishes events through Kafka/outbox boundaries; inventory and seller queues consume the state.
5. Seller accepts and ships; shipping uses the configured GHN/GHTK mode and produces tracking/status events.
6. Buyer sees the order, submits a review, and receives the backend moderation status. Pending moderation is not treated as public approval.
7. Seller requests a payout; seller-finance exposes the pending balance and admin queue.
8. Admin completes the payout; the wallet projection and audit trail settle asynchronously.

## Evidence Sources

- Playwright full gate: the command is `cd fe; npx playwright test --reporter=line`.
- API gate: `fe/e2e/day-simulation.spec.ts` and the focused API suites.
- Business journey: `fe/e2e/journey/01` through `06` plus `JOURNEY-REPORT.md`.
- Persona workdays: `fe/e2e/workday-buyer.spec.ts`, `workday-seller.spec.ts`, `workday-admin.spec.ts`.
- Independent browser evidence: `fe/e2e/evidence/agent-browser-audit/`.
- Network diagnostic: `fe/e2e/network-diagnostic.spec.ts` with `@diagnostic`.

## Coverage Boundary

Passing local tests prove the configured Docker/stub environment. They do not prove live GHN/GHTK callbacks, real provider credentials, production TLS/DNS, external social login, or production secrets/overrides. Those limitations are tracked in `EVIDENCE-REVIEW.md`.

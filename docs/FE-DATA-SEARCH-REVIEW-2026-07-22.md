# FE Data and Search Contract Review

**Date:** 2026-07-22<br>
**Scope:** React web application, admin control plane, seller workflows, buyer order/cart surfaces, and the backing HTTP contracts.<br>
**Verdict:** **NEEDS ATTENTION - do not treat the operator experience as production-ready.**

## Executive Summary

The frontend is functional for the happy paths, but several operator pages are built around identifiers instead of human-readable projections. The catalog `search-service` is not the missing dependency: it is correctly scoped to product/category discovery. The missing capability is role-scoped search/read models for users, orders, sellers, disputes, payouts, reviews, and moderation queues.

The highest-risk issues are contract-level:

1. Admin user search exposes only `email` and `phone`, while the user repository currently treats the email term as a name lookup.
2. Admin order search does not exist. The backend accepts only status and returns a bounded, flat list containing IDs but no buyer/shop names.
3. Video preview and appeal queue response shapes disagree between Spring and Zod, so valid backend responses can be rejected by the frontend parser.
4. Admin review rejection and dispute resolution send fields the backend does not consume.
5. Multiple UI searches filter the already-loaded page in memory, creating false confidence and incomplete results.

## Closure Pass Status

The implementation pass following this review resolved the contract failures and the highest-risk local-search paths. The original findings below are retained as the baseline review; their current status is:

| Finding | Current status | Implementation evidence |
| --- | --- | --- |
| Admin user query contract | **Resolved** | `GET /admin/users?q=&page=&size=` searches normalized email, name, phone, and user ID; the FE renders the returned name/email projection and uses the page contract. Buyer email is persisted by `user-service` migration `V9__buyer_email.sql`. |
| Admin order search and hidden limit | **Resolved** | `GET /admin/orders?q=&status=&page=&size=` uses a bounded Spring `Page`; `LIMIT 200` was removed, `orderNumber` is projected and backfilled by `V28__order_summary_order_number.sql`, and `order-service` batch-resolves buyer/shop names from `user-service` before the FE receives the page. |
| Video preview and appeal queue schemas | **Resolved** | The FE accepts the backend string preview payload and the paginated appeal response; the appeal page reads `content` and `totalElements`. |
| Review rejection payload | **Resolved** | `RejectReviewRequest(reason)` is validated by the controller and persisted as `rejection_reason` by `V10__review_rejection_reason.sql`. |
| Dispute resolution payload | **Resolved** | The FE sends `adminResolution`, matching the existing backend request DTO. Dispute list search is now passed to `order-service`. |
| FE lint blocker | **Resolved** | `pnpm lint` now reports 0 errors. Twenty-five pre-existing warnings remain. |
| Seller, payout, seller-order, seller-approval, dispute, and review search | **Partially resolved** | The owning services now receive normalized server-side `q` values and the FE query keys include them. Several endpoints still return flat arrays instead of the target page contract. |
| Human-readable contextual projections | **Resolved for current queue contracts** | `order-service` enriches admin orders and disputes; `seller-finance-service` enriches admin payouts; and `product-service` enriches seller/admin review rows with buyer and product labels. UUIDs remain available as secondary diagnostic fields. |
| Cart seller projection | **Resolved for new snapshots; migration residual remains** | `cart-service` resolves the product seller and shop name through `product-service` plus `user-service`, then persists `sellerId`/`sellerName` in Redis and PostgreSQL cart snapshots. Existing carts created before this contract have no seller snapshot and intentionally render the generic seller label until the item is refreshed. |
| Seller review management | **Resolved** | `product-service` now exposes `GET /reviews/seller/me?q=&page=&size=` with JWT seller scoping, approved-review filtering, product-name enrichment, and buyer-profile enrichment. The FE seller tab consumes the paginated contract. |

### Implemented query boundaries

- Public `search-service` remains product/catalog-only.
- Admin users, orders, sellers, payouts, disputes, and review moderation query their owning services.
- Admin order and dispute rows are assembled by `order-service`; payout shop labels are assembled by `seller-finance-service`; admin and seller review labels are assembled by `product-service`.
- Cross-service labels use bounded batch calls to `user-service` public-profile projections. The FE does not issue per-row identity lookups.
- Seller pending orders query `order-service` with the authenticated seller scope plus `q`; the FE no longer filters the loaded list by ID in memory.
- Admin payouts, seller approvals, disputes, and seller orders invalidate/query by search state so a query cannot silently reuse an unrelated unfiltered cache entry.
- Review moderation now searches review ID, product ID/name, buyer ID, order ID, and comment text within the product service.

### Residual production work

1. Add a shared `OperatorPage<T>` response to the still-flat seller, payout, dispute, review, and video moderation APIs, with stable sort and bounded page size.
2. Migrate the remaining flat operator queues to a shared bounded page contract and add regression tests that assert human-facing primary labels are not UUIDs.
3. Add controller/integration coverage for the new native search queries and migration-backed columns against PostgreSQL. Java compilation proves type compatibility, but it does not validate SQL semantics against a live schema.

## Findings

### P1 - Admin user search cannot find users by the fields the UI implies

**Category:** API contract, operator workflow, data discoverability<br>
**Evidence:** [`fe/src/app/lib/api/endpoints/admin.ts:27`](../fe/src/app/lib/api/endpoints/admin.ts), [`fe/src/app/pages/admin/UserManagement.tsx:18`](../fe/src/app/pages/admin/UserManagement.tsx), [`services/user-service/src/main/java/com/vnshop/userservice/infrastructure/web/AdminUserController.java:25`](../services/user-service/src/main/java/com/vnshop/userservice/infrastructure/web/AdminUserController.java), [`services/user-service/src/main/java/com/vnshop/userservice/infrastructure/persistence/UserJpaRepository.java:114`](../services/user-service/src/main/java/com/vnshop/userservice/infrastructure/persistence/UserJpaRepository.java)

The FE has separate inputs named email and phone and sends only those two parameters. The backend has no `q`, name, ID, paging, or sorting contract. More seriously, the repository's email branch searches `lower(b.name)` rather than an email column. The result row contains `name`, but the FE falls back to `keycloakId` when it is null.

**Impact:** An admin cannot reliably locate a buyer by display name, Keycloak/user ID, order reference, or actual email. The search label promises a capability the backend does not implement, and the fallback exposes an internal identity as the primary label.

**Recommendation:** Add a role-scoped, paginated directory query such as `GET /admin/users?q=&page=&size=`. Search exact ID/reference, normalized email/phone, and indexed name. Return a non-optional operator `displayName` plus secondary `id`, masked contact data, and a stable cursor/page contract.

### P1 - Admin order management has no search and the read model is UUID-only

**Category:** API design, scalability, operator workflow<br>
**Evidence:** [`fe/src/app/pages/admin/OrderManagement.tsx:57`](../fe/src/app/pages/admin/OrderManagement.tsx), [`fe/src/app/pages/admin/OrderManagement.tsx:152`](../fe/src/app/pages/admin/OrderManagement.tsx), [`services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/AdminOrderController.java:30`](../services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/AdminOrderController.java), [`services/order-service/src/main/java/com/vnshop/orderservice/domain/projection/OrderSummaryProjection.java:6`](../services/order-service/src/main/java/com/vnshop/orderservice/domain/projection/OrderSummaryProjection.java), [`services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/persistence/OrderSummaryQueryPortAdapter.java:79`](../services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/persistence/OrderSummaryQueryPortAdapter.java)

The page sends only `status`. Rows render `orderId` and `buyerId`. The backend returns `List<OrderSummaryProjection>` and the native query has a hard `LIMIT 200`; it does not return a page object, buyer name, seller/shop name, order number, or search metadata.

**Impact:** Support staff cannot search by order number, buyer name, buyer contact, seller/shop, or tracking reference. More than 200 matches are silently unavailable, while raw UUIDs make the queue slow to operate and difficult to audit.

**Recommendation:** Introduce `GET /admin/orders?q=&status=&buyerId=&sellerId=&page=&size=` with stable ordering. Return `reference`, `displayName`/context objects for buyer and seller, and retain IDs only as secondary metadata. Remove the hidden fixed limit in favor of an explicit bounded page size.

### P1 - Video preview and appeal queue wire schemas disagree with the backend

**Category:** API contract, runtime parsing<br>
**Evidence:** [`fe/src/app/lib/api/endpoints/admin.ts:140`](../fe/src/app/lib/api/endpoints/admin.ts), [`fe/src/app/types/api/admin.ts:315`](../fe/src/app/types/api/admin.ts), [`services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/AdminVideoController.java:40`](../services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/AdminVideoController.java), [`fe/src/app/lib/api/endpoints/admin.ts:158`](../fe/src/app/lib/api/endpoints/admin.ts), [`services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/AdminVideoController.java:65`](../services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/AdminVideoController.java)

`GET /admin/videos/{videoId}/preview` returns `ApiResponse<String>` containing the URL, but the FE validates `{ url: string }`. The response interceptor unwraps the envelope and then validates the inner data, so a valid string is a malformed-response error. Separately, the backend appeal queue returns `Page<VideoModerationResponse>`, while the FE endpoint expects a flat array.

**Impact:** Admin preview and appeal count/list flows can fail even when the service is healthy.

**Recommendation:** Choose one wire shape and apply it on both sides. Prefer `{ url, expiresAt }` for preview and the shared `OperatorPage<T>` shape for appeals. Add controller tests and FE fixture tests for the exact envelope and inner payload.

### P1 - Admin review rejection and dispute resolution send unconsumed fields

**Category:** Mutation contract, data integrity<br>
**Evidence:** [`fe/src/app/lib/api/endpoints/admin.ts:58`](../fe/src/app/lib/api/endpoints/admin.ts), [`services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/review/AdminReviewController.java:35`](../services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/review/AdminReviewController.java), [`fe/src/app/lib/api/endpoints/admin.ts:87`](../fe/src/app/lib/api/endpoints/admin.ts), [`services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/ResolveDisputeRequest.java:5`](../services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/ResolveDisputeRequest.java), [`services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/AdminDisputeController.java:39`](../services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/AdminDisputeController.java)

The FE sends `{ reason }` for review rejection, but the controller accepts only the path variable and never reads a request body. The FE sends `{ resolution, refundAmount }` for dispute resolution, while the backend requires `adminResolution`; `refundAmount` is not part of the request record.

**Impact:** Admin-entered rejection/resolution context is discarded or the request is rejected with validation failure. The UI can show a successful-looking workflow without persisting the operator's actual decision.

**Recommendation:** Define explicit request DTOs per mutation, for example `RejectReviewRequest(reason)` and `ResolveDisputeRequest(adminResolution, refundAmount, currency)`. Make the FE schemas derive from those contracts and add request-body assertions to controller tests.

### P1 - Frontend lint is currently CI-blocking

**Category:** Build quality gate<br>
**Evidence:** [`fe/src/app/pages/RegisterPage.tsx:92`](../fe/src/app/pages/RegisterPage.tsx)

`pnpm lint` fails on an unhandled `navigate(...)` promise (`@typescript-eslint/no-floating-promises`). There are also 25 warnings, including array-index keys and import ordering. TypeScript and Vitest pass, but the lint failure means the frontend is not green for a production merge.

**Recommendation:** Mark the navigation promise as intentionally ignored or await it according to the router contract, then reduce the warnings in the touched areas. Keep lint in the required CI gate.

### P2 - UUIDs are used as primary labels across operator and buyer surfaces

**Category:** Read-model quality, usability, privacy<br>
**Evidence:** [`fe/src/app/pages/admin/UserManagement.tsx:135`](../fe/src/app/pages/admin/UserManagement.tsx), [`fe/src/app/pages/admin/UserManagement.tsx:184`](../fe/src/app/pages/admin/UserManagement.tsx), [`fe/src/app/pages/admin/OrderManagement.tsx:155`](../fe/src/app/pages/admin/OrderManagement.tsx), [`fe/src/app/pages/admin/DisputesQueue.tsx:91`](../fe/src/app/pages/admin/DisputesQueue.tsx), [`fe/src/app/pages/admin/ReviewsModeration.tsx:89`](../fe/src/app/pages/admin/ReviewsModeration.tsx), [`fe/src/app/pages/admin/VideoModeration.tsx:179`](../fe/src/app/pages/admin/VideoModeration.tsx), [`fe/src/app/pages/CartPage.tsx:215`](../fe/src/app/pages/CartPage.tsx)

The FE frequently renders `keycloakId`, `orderId`, `buyerId`, `returnId`, `productId`, `videoId`, or `sellerId` when the corresponding name is absent. Cart grouping explicitly assigns `sellerName` from `sellerId` when no shop name is present.

**Impact:** Operators and buyers see opaque internal identifiers as the main context. This increases selection errors and makes the interface look incomplete. It also turns a missing enrichment into a silent fallback instead of a contract failure.

**Recommendation:** Make display projections required for human-facing rows: `buyer.displayName`, `seller.displayName`, `product.name`, `order.reference`, and `video.ownerDisplayName`. Keep UUIDs in a secondary details/diagnostic field and test that the primary cell never falls back to an ID.

### P2 - Local filtering hides missing server-side search

**Category:** Search semantics, scalability<br>
**Evidence:** [`fe/src/app/pages/admin/SellersApproval.tsx:53`](../fe/src/app/pages/admin/SellersApproval.tsx), [`fe/src/app/pages/admin/PayoutsQueue.tsx:99`](../fe/src/app/pages/admin/PayoutsQueue.tsx), [`fe/src/app/pages/seller/SellerOrders.tsx:101`](../fe/src/app/pages/seller/SellerOrders.tsx), [`fe/src/app/pages/seller/SellerProducts.tsx:31`](../fe/src/app/pages/seller/SellerProducts.tsx), [`services/user-service/src/main/java/com/vnshop/userservice/infrastructure/web/AdminSellerController.java:30`](../services/user-service/src/main/java/com/vnshop/userservice/infrastructure/web/AdminSellerController.java)

Seller approvals fetch all pending sellers and filter only `shopName` in the browser. Payouts fetch flat lists and filter seller/payout IDs locally. Seller orders fetch the pending list, flatten it, and filter only local suborder/order IDs. Seller products filter the currently loaded catalog page.

**Impact:** Search results are incomplete once the dataset exceeds the initial response. Memory, latency, and authorization behavior are coupled to list endpoints. The UI appears to support search but cannot find records outside the loaded slice.

**Recommendation:** Move query state into React Query keys and send normalized `q`, status, page/cursor, and size to the owning service. Keep local filtering only for small, already-bounded option lists.

### P2 - Admin queues lack consistent pagination and contextual projections

**Category:** API consistency, scalability<br>
**Evidence:** [`fe/src/app/lib/api/endpoints/admin.ts:49`](../fe/src/app/lib/api/endpoints/admin.ts), [`fe/src/app/lib/api/endpoints/admin.ts:55`](../fe/src/app/lib/api/endpoints/admin.ts), [`fe/src/app/lib/api/endpoints/admin.ts:86`](../fe/src/app/lib/api/endpoints/admin.ts), [`fe/src/app/lib/api/endpoints/admin.ts:92`](../fe/src/app/lib/api/endpoints/admin.ts), [`services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/DisputeResponse.java:5`](../services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/web/DisputeResponse.java), [`services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/web/PayoutResponse.java:8`](../services/seller-finance-service/src/main/java/com/vnshop/sellerfinanceservice/infrastructure/web/PayoutResponse.java)

Sellers, pending reviews, disputes, and payouts use flat arrays. Disputes expose dispute/return IDs without order, buyer, seller, or created-at context. Payouts expose seller ID without a required seller name. Reviews and moderation responses make names optional and document the ID fallback.

**Impact:** Queues have no stable page boundary, no consistent sorting contract, and no reliable human context. Large datasets will either become slow or silently incomplete.

**Recommendation:** Standardize operator lists on one bounded page contract, with `content`, `page`, `size`, `totalElements`, `totalPages`, and stable sort metadata. Add contextual projections at the read boundary instead of issuing FE-side per-row lookups.

### P3 - Buyer order history and catalog-adjacent seller lists have limited queryability

**Category:** Product workflow completeness<br>
**Evidence:** [`fe/src/app/pages/OrdersPage.tsx:677`](../fe/src/app/pages/OrdersPage.tsx), [`fe/src/app/pages/seller/SellerProducts.tsx:31`](../fe/src/app/pages/seller/SellerProducts.tsx)

Buyer order history filters by status after loading the service's result set and has no keyword/reference search. Seller product search is limited to the currently loaded catalog slice. These are lower severity than the admin control-plane gaps, but the same query-state pattern should be corrected where users manage long histories.

## Capability Inventory

| Surface | Current query | Current data quality | Review result |
| --- | --- | --- | --- |
| Admin users | email/phone only | name optional, keycloak ID fallback | Missing name/ID/query contract |
| Admin orders | status only | order/buyer/seller IDs | Missing search, names, and page contract |
| Seller approvals | browser filter | shop name available | Server query and pagination missing |
| Seller orders | browser filter on IDs | nested order data, no buyer projection | Server query and page contract missing |
| Payouts | browser filter on IDs | seller name optional | Server query, page, and seller projection missing |
| Disputes | no search | return/dispute IDs only | Context projection and page missing |
| Reviews | no search | user/product IDs, name optional | Query, page, and product/buyer context missing |
| Video moderation | page/date/score filters | uploader/product IDs, name optional | `q` and contract alignment missing |
| Buyer orders | status tab | order data available | Keyword/reference search missing |
| Catalog | product query/search service | product-oriented | Correct boundary; do not use for private admin data |

## Target API Contract

Keep the existing catalog search service product-only. Add role-scoped read endpoints in the owning domain or a gateway-backed operator read model. Do not solve this with frontend fan-out to user/order/seller services.

```json
{
  "content": [
    {
      "id": "uuid",
      "reference": "VN-2026-000123",
      "displayName": "Nguyen Van A",
      "buyer": { "id": "uuid", "displayName": "Nguyen Van A", "email": "masked@example.com" },
      "seller": { "id": "uuid", "displayName": "Example Shop" },
      "status": "SHIPPED",
      "createdAt": "2026-07-22T10:00:00Z"
    }
  ],
  "page": 0,
  "size": 50,
  "totalElements": 123,
  "totalPages": 3
}
```

Required query rules:

- `q` is normalized, bounded, and requires at least two characters unless it is an exact ID/reference lookup.
- Search exact ID/reference first, then indexed prefix/contains matches for allowed name, email, phone, shop, and tracking fields.
- Default size 50, maximum size 100, stable sort by `createdAt DESC, id DESC`.
- Admin endpoints require the admin role; seller endpoints are scoped to the authenticated seller and never accept an arbitrary seller ID as authority.
- PII is masked in list rows. Details endpoints can expose more data only after authorization.
- `400` covers invalid query bounds, `401/403` auth failures, `404` missing resources, `409` state conflicts, and `429` rate limiting. Keep the existing error envelope and correlation ID.

## Remediation Plan

1. **Contract foundation:** define shared `OperatorPage<T>`, query validation, stable sort, and display projection types. Add backend controller/security tests and FE Zod fixtures.
2. **Admin users and orders:** add `q`, pagination, reference/name projections, and explicit status filters. Remove the order query's hidden `LIMIT 200`.
3. **Mutation alignment:** fix review reject and dispute resolve DTOs, including persisted reason/refund fields. Add request-body contract tests.
4. **Queue consistency:** migrate sellers, payouts, disputes, reviews, and video appeals to the page contract. Server-side search and current contextual projections are already in their owning services.
5. **Frontend adoption:** make operator rows render display fields as primary text, keep IDs in secondary detail/tooltip content, and add loading/empty/error/pagination states.
6. **End-to-end proof:** Playwright tests for admin user/order search, seller order search, payout/dispute/review queues, video preview/appeals, and the no-UUID-primary-label rule.

## Verification and Residual Risk

- Repository evidence was collected from the FE endpoints, Zod schemas, page components, Spring controllers, response DTOs, and persistence adapters listed above.
- Closure-pass verification: `pnpm typecheck`, `pnpm build`, and `pnpm lint` passed; lint reports 0 errors and 25 existing warnings. `pnpm exec vitest run` passed with 87 files and 592 tests. Product-service review/persistence tests passed with 7 tests. `git diff --check` passed; its output only reports existing CRLF normalization notices. Existing repository smoke evidence from the prior validation round included the full API E2E suite: 66 passed, 0 failed.
- The remaining work is explicitly listed in the Closure Pass Status section: live PostgreSQL SQL/integration coverage for the new native queries and shared pagination for flat queues.
- `docs/*` is ignored by the current `.gitignore`; this review's markdown and presentation are explicitly unignored so they can be tracked.

# Architecture Decisions

## 2026-07-22 - Separate catalog search from operator directory search

- Keep `search-service` scoped to public catalog, category, suggestion, and facet search.
- Do not add private buyer, order, seller, payout, or dispute records to the product index.
- Add role-scoped, paginated operator read models in the owning domain or behind the gateway.
- Operator list rows must return required human-readable projections (`displayName`, `reference`, and contextual buyer/seller/product names) while retaining UUIDs as secondary identifiers.
- Cross-service contextual names must be resolved by the owning service boundary, never by frontend per-row fan-out. `order-service` owns the admin order page and batches buyer/shop projections from `user-service`; `product-service` owns seller review pages and enriches buyer/product context before returning the page.
- Cart item seller context is a snapshot concern. `cart-service` obtains seller identity from the product read response and shop name from `user-service`, then persists both values so cart rendering does not call a service or invent a name in the browser.
- Query endpoints use bounded `q`, explicit filters, stable sorting, and a consistent page contract. Frontend local filtering is reserved for already-bounded option lists.
- Mutation DTOs are explicit and must be covered by controller and frontend contract tests so operator reasons and resolution fields cannot be silently dropped.

## 2026-07-22 - Keep unresolved display projections explicit

- Do not turn a UUID into a fake display name in the frontend.
- When an owning service does not yet expose buyer, seller, product, or shop context, retain the ID as secondary diagnostic data and record the missing projection as a backend/read-model follow-up.
- Add server-side `q` at the owning service boundary before adding another frontend-only filter. The public catalog index remains out of scope for private operator records.

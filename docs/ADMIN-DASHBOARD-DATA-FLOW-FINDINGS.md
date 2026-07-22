# Admin Dashboard Data-Flow Findings

Status: code closure applied; runtime verification remains pending because Docker is disabled.

## Reader And Action

This document is for engineers and reviewers changing the admin dashboard. After reading it, the reader should be able to implement the dashboard contract without confusing units, time windows, payment state, seller attribution, or display names.

## Confirmed Request Flow

```text
AdminDashboard
  -> React Query: one report query; export reuses its asOf snapshot when available
  -> API gateway: /admin/dashboard/**
  -> order-service AdminDashboardController
  -> GetDashboardUseCase captures one server asOf instant
  -> DashboardAnalyticsAdapter
  -> OrderJpaSpringDataRepository + refund_ledger
  -> order_svc PostgreSQL tables and projections
  -> one ApiResponse report envelope
  -> frontend schema validation
  -> KPI cards, charts, and bounded CSV download
```

The gateway routes `/admin/dashboard/**` to order-service. The controller requires the ADMIN role. The frontend client unwraps and validates the API envelope before React Query receives the data. The primary page uses `GET /admin/dashboard/report`, so all widgets share the server-provided `asOf` value.

## Implemented v2 Contract

All dashboard routes are ADMIN-only and accept ISO dates. When omitted, the period is the last 30 UTC calendar days.

| Endpoint | Query | Response meaning |
|---|---|---|
| `GET /admin/dashboard/report` | `from`, `to`, `granularity=day|week|month`, `limit=1..200` | One `asOf` snapshot containing summary, revenue, top products, top sellers, and the applied period |
| `GET /admin/dashboard/export` | Same validated query as report plus optional `asOf` from the report response | ADMIN-only UTF-8 CSV generated from the requested snapshot |
| `GET /admin/dashboard/summary` | `from`, `to` | `paidGmv`, `refundedAmount`, `realizedRevenue`, paid order count, active buyers, active sellers, average paid order value, and the applied period |
| `GET /admin/dashboard/revenue` | `from`, `to`, `granularity=day|week|month` | `points[]` with `date`, `paidGmv`, `refundedAmount`, and `realizedRevenue` |
| `GET /admin/dashboard/top-products` | `from`, `to`, `limit=1..200` | `productId`, `name`, and `unitsSold` |
| `GET /admin/dashboard/top-sellers` | `from`, `to`, `limit=1..200` | `sellerId`, nullable `shopName`, and seller-owned `paidGmv` |

`paidGmv` includes orders whose order payment status is `COMPLETED` and is measured before refund deductions. `refundedAmount` sums confirmed VND refund-ledger entries for orders created in the report period and visible at or before `asOf`. `realizedRevenue = paidGmv - refundedAmount`. The refund ledger is keyed by provider `refundId`, so duplicate payment-refunded deliveries do not subtract twice. A refund received after the order period can revise that period's realized value; the response `asOf` makes that historical read reproducible. The frontend no longer accepts legacy `revenue`, `value`, `totalUsers`, or UUID-as-name aliases for these v2 responses.

The refund ledger is populated by the order-service `PaymentRefundedListener` after a confirmed
`payment.refunded` event. It records `refundId`, order/return/seller references, VND amount,
provider status, and the listener clock instant. Invalid financial payloads throw into the
retry/DLT path; non-completed provider statuses are ignored until a completed event arrives.

## Closure Ledger

| Finding | Status | Evidence | Release gate |
|---|---|---|---|
| Product chart used money for quantities | fixed | `unitsSold` contract and count axis | code/static |
| Seller ranking repeated parent order totals | fixed | seller-owned paid GMV query and projection test | code/static |
| Payment/refund inclusion was undefined | fixed | completed-payment filters plus refund ledger tests | code/static |
| Admin refund stopped before payment refund | fixed in code | return completion and durable refund outbox path | database/runtime |
| Query parameters were ignored | fixed | validated `DashboardQuery` and controller contract tests | code/static |
| Active counts were mislabeled as totals | fixed | `activeBuyers`/`activeSellers` wire and UI labels | code/static |
| Seller UUIDs were shown as names | fixed in code | user-directory enrichment with `Unknown shop` fallback | gateway/runtime |
| Dashboard widgets used different snapshots | fixed | aggregate report plus export `asOf` reuse test | code/static |
| CSV export was a placeholder | fixed | bounded ADMIN CSV endpoint and binary client test | gateway/browser |
| Migration, live gateway, and browser evidence | blocked-external | Docker unavailable; no live topology in this run | runtime |

## Findings

### High: top products use the wrong unit (resolved in v2)

The repository ranks products by `sum(item.quantity)`. The frontend transforms the value into `revenue`, uses a revenue formatter, and labels the axis in millions of VND. This is an all-time units-sold query rendered as money.

Original evidence before the v2 repair:

- `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/persistence/OrderJpaSpringDataRepository.java`
- `fe/src/app/types/api/admin.ts`
- `fe/src/app/pages/admin/AdminDashboard.tsx`

Recommended contract: return `unitsSold` and render a count. If the product chart must show money, change the query to a status-qualified item amount and name the field `revenue`.

Resolution: the v2 read model returns `unitsSold`, the frontend uses a count formatter, and
the chart tooltip labels the quantity unit.

### High: seller ranking double-counts multi-seller orders (resolved in v2)

Original evidence before the v2 repair: the dashboard seller query grouped by seller sub-order
but summed the parent order's `finalAmount`. Every seller in a multi-seller checkout received the
full buyer total.

The order outbox already contains the correct seller-owned `sellerTotals` projection, and seller-finance consumes that projection for wallet credits. The dashboard should reuse the same seller-owned item-subtotal rule, or read a finance settlement projection, rather than inventing a second allocation for shipping, discounts, or tax.

Resolution: top sellers use seller-owned paid GMV from the sub-order/item allocation and are
batch-enriched with `shopName`; the parent order total is not repeated for each seller.

### High: financial metrics have no inclusion policy (resolved in v2)

Original evidence before the v2 repair: summary, revenue, and rankings filtered only by
`createdAt`. Payment and fulfillment states were not applied. Pending, failed, disputed,
cancelled, and rejected records could therefore affect money and activity metrics.

The platform has separate payment and fulfillment state machines. A dashboard must name the metric it reports:

- `bookedGmv`: order value accepted by the marketplace, with a documented booking rule.
- `paidGmv`: payment-completed order value before refunds.
- `realizedRevenue`: delivered, payment-completed value net of confirmed refunds.
- `pendingExposure`: created but not yet completed value.

Resolution: expose `paidGmv` explicitly for payment-completed order value before refund deductions,
then expose `refundedAmount` and `realizedRevenue` from the idempotent refund ledger. Fulfillment
state is not silently substituted for payment state in this dashboard contract.

### High: admin refund does not start the payment refund workflow (resolved in code; runtime pending)

The admin `forceRefund` path marks the order `DISPUTED` and emits `ORDER_UPDATED`. Payment-service listens for `payment.refund.requested`, but this admin action does not emit it. The existing `CompleteReturnUseCase` does stage a return-specific refund outbox event, and payment-service then performs the gateway refund. Dispute resolution only changes the dispute record; it does not complete the return.

Resolution: admin order refund now creates or reuses one return per sub-order, approves and
completes through the existing return use cases, stages the existing durable payment refund
outbox event, and is reflected by the refund ledger after payment confirmation. A unique database
index prevents concurrent duplicate return workflows.

### High: request parameters are silently ignored (resolved in v2)

Original evidence before the v2 repair: the frontend sent `granularity=month` and `limit=5`,
while the backend controller accepted no parameters. The use case always computed a 30-day
daily series and requested ten top items.

Recommended contract: validate and apply `from`, `to`, `granularity`, and `limit`, or remove them from the frontend. An accepted-but-ignored parameter is a contract defect.

Resolution: `DashboardQuery` validates the date window, granularity, and bounded top-list limit;
the controller passes the values through to the aggregate report and export.

### High: active counts are shown as totals (resolved in v2)

The backend returns `activeBuyers` and `activeSellers` for the fixed 30-day period. The frontend aliases them to `totalUsers` and `totalSellers`, then renders total labels.

Recommended contract: display `Active buyers (30 days)` and `Active sellers (30 days)`, or add true total-count read APIs. Do not hide the distinction in a compatibility transform.

Resolution: the wire names and dashboard labels remain `activeBuyers` and `activeSellers`.

### Medium: seller identifiers replace display names (resolved in v2)

The seller query sets both the seller ID and name to the seller UUID. The frontend falls back to the UUID when `shopName` is absent. A user directory port already exists and is used by other admin projections; the dashboard read projection should use it as a batch enrichment step.

Recommended response:

```json
{
  "sellerId": "...",
  "shopName": "Example Shop",
  "amount": 2023315000
}
```

Resolution: the order-service user directory adapter supplies `shopName` in the report. A
nullable value renders as the explicit `Unknown shop` label; the UUID remains available only
as the stable identifier.

The ID remains available for drill-down, but the default operator label must be a display projection or an explicit `Unknown shop` value.

### Medium: independent requests create inconsistent snapshots (resolved in v2)

The old page executed four independent queries. The v2 page uses one report request with one
server `asOf`, and a failed report stays visible with a retry action instead of becoming empty
charts. The individual widget routes remain for compatibility and drill-down.

The export button sends that `asOf` back to the export endpoint, so the downloaded CSV uses the
same financial snapshot as the visible page. A direct export without `asOf` remains supported and
captures a new server snapshot.

Recommended contract: pass one report timestamp or use one aggregate dashboard response. At minimum, expose widget-level errors and the reporting period returned by the backend.

### Medium: export is a placeholder (resolved in v2)

`GET /admin/dashboard/export` now returns the same bounded report data as CSV. The frontend
downloads it through the binary API path and surfaces an error state when the request fails.

## Repair Sequence

1. Write the typed dashboard API contract and metric definitions.
2. Add a validated `DashboardQuery` with date range, granularity, limit, and metric basis.
3. Capture one reporting clock/time window per dashboard read.
4. Correct repository aggregates and add status/refund inclusion rules.
5. Reuse seller-owned outbox/settlement attribution and enrich shop names through the directory projection.
6. Route admin refund decisions through return completion or a dedicated idempotent refund aggregate.
7. Replace frontend aliases with strict wire names and correct chart units.
8. Add backend repository, controller, refund-flow, gateway, and frontend contract tests.
9. Add visible period labels, widget errors, retry controls, and a report/export snapshot contract.

## Verification Gates

- A multi-seller order never assigns the full parent total to each seller.
- Quantity is never formatted as currency.
- Pending, failed, cancelled, disputed, rejected, delivered, refunded, and completed records follow the documented metric policy.
- Changing `from`, `to`, `granularity`, or `limit` changes the response or is rejected with `400`.
- Refund success and failure are idempotent and visible to dashboard aggregation; malformed
  financial events remain retryable/DLT-visible.
- The report and CSV endpoints use one `asOf` snapshot and enforce ADMIN authorization.
- Admin refund never stops at `DISPUTED`; it reaches the same durable refund command path as a completed return.
- Admin cards distinguish active counts from platform totals.
- Seller names render without exposing UUIDs as the primary label.
- The frontend has tests for chart units and widget error states.

## Review Evidence

The independent second-opinion review agreed with the original high-severity findings and confirmed the refund workflow gap. The current focused backend report/refund/controller suite passes (`16/16`), the isolated order-service gate passes (`181/181`), the frontend dashboard/client contract suite passes (`16/16`), all frontend tests pass (`598/598`), frontend typecheck and lint pass with existing warnings only, the production build passes, and the i18n key gate passes (`1,096` static keys across `en` and `vi`). Repository/JPA calculation tests, migration validation, gateway authorization through the live topology, browser/runtime checks, and repository-wide formatting remain pending because Docker is disabled or unrelated dirty files need formatting.

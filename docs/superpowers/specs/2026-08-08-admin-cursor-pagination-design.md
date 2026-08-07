# Admin Cursor Pagination for 10M+ Records

## Status

Approved design. This document covers the admin list surfaces selected for the
pagination redesign: orders, users, seller approvals, reviews, disputes,
payouts, coupons, and video moderation queues.

## Context and current problems

The admin console currently has mixed list contracts:

- Orders and users use Spring `Page<T>` responses with offset pagination.
- Payouts have both paginated and unbounded legacy endpoints.
- Sellers, reviews, disputes, and coupons expose unbounded arrays.
- The shared admin frame renders a desktop table and exact `Page N of M`
  controls.
- At a 390px viewport the desktop table is wider than the content area, so the
  list and pagination controls overflow horizontally.

At 10 million rows, deep offset pagination makes the database scan and discard
large prefixes of the result set. Exact totals on every request add an
unnecessary count query to the normal operational path.

## Goals

1. Keep each normal list request bounded by the requested page size rather than
   the depth of the traversal.
2. Provide one consistent pagination contract for all large admin lists.
3. Preserve stable ordering while rows are inserted or updated concurrently.
4. Keep filters, sorting, and search tied to the cursor that produced them.
5. Remove unbounded list responses from the admin UI path.
6. Make the admin list usable at desktop and mobile widths.
7. Preserve existing mutations, drawers, permissions, and queue behavior.
8. Make query latency, cursor failures, and database pressure observable.

## Non-goals

- Replacing the existing relational databases with a new datastore.
- Building a global search product or fuzzy search platform.
- Providing random access to an arbitrary page number in the cursor mode.
- Adding a real-time push channel for admin queues.
- Changing dashboard aggregates, charts, exports, or report snapshots.
- Removing legacy offset endpoints in the first rollout.

## Scale assumptions and targets

The initial design target is 10 million records in any one list, with a default
page size of 50 and a hard maximum of 100. The expected normal list payload is
below 150 KB. The operational target is p95 below 300 ms and p99 below 750 ms
for indexed cursor reads, subject to downstream enrichment.

The design should support approximately 1-10 admin list requests per second in
normal operation and a short burst of roughly 50 requests per second across all
admin lists. These are capacity targets for query shape and protection, not a
claim about current traffic.

## Chosen approach

Use cursor/keyset pagination as the primary admin contract. Keep offset mode as
a temporary compatibility path for existing clients during migration.

### Rejected alternatives

**Offset-only pagination** is rejected as the final design because deep offsets
degrade with traversal depth and exact totals encourage expensive `COUNT(*)`
queries.

**Exact totals on every response** are rejected because they add a count query to
every operational read and do not improve the main admin workflow enough to
justify the load.

**A new search datastore immediately** is rejected because the primary access
pattern is ordered, filtered relational reads. Indexes and keyset queries are
the cheaper first step. Search infrastructure can be added later if measured
cross-field fuzzy search requires it.

## API contract

Each large admin list supports cursor mode with the following shape:

```http
GET /admin/orders?limit=50&cursor=<opaque-token>&q=buyer&status=PENDING
```

```json
{
  "items": [],
  "nextCursor": "opaque-signed-token",
  "hasMore": true,
  "pageSize": 50,
  "sort": {
    "field": "createdAt",
    "direction": "desc"
  },
  "snapshot": {
    "asOf": "2026-08-08T00:00:00Z"
  }
}
```

`nextCursor` is `null` when no further rows exist. The normal response does
not contain `totalElements` or `totalPages`.

The cursor is opaque, signed, and short-lived. Its payload contains the
resource, filter hash, sort definition, last row's sort key, last row's unique
ID, optional `asOf` boundary, and expiry. The server rejects a cursor when its
signature, expiry, resource, filters, or sort definition do not match.

The request parser clamps `limit` to the service maximum. Invalid limits,
unknown sort fields, and malformed cursors return the existing error envelope
with stable codes:

- `cursor_invalid`
- `cursor_scope_mismatch`
- `invalid_page_size`
- `invalid_sort`

Legacy offset endpoints remain available during migration. New frontend calls
use cursor mode explicitly so the migration can be rolled out service by
service.

## Ordering and query shape

Every cursor-enabled list has a deterministic order with a unique tie-breaker.
The default newest-first order is:

```sql
ORDER BY created_at DESC, id DESC
```

The next-page predicate is:

```sql
WHERE created_at < :lastCreatedAt
   OR (created_at = :lastCreatedAt AND id < :lastId)
ORDER BY created_at DESC, id DESC
LIMIT :limitPlusOne
```

The extra row determines `hasMore` without a count query. Alphabetical lists
use a normalized name plus ID tie-breaker. Status-filtered lists include the
status predicate in the same indexed access path.

Recommended index families, adapted to each service's actual table and ID
column names, are:

```sql
-- orders
(status, created_at DESC, id DESC)
(created_at DESC, id DESC)

-- users
(normalized_name ASC, id ASC)
(created_at DESC, id DESC)

-- reviews
(status, created_at DESC, review_id DESC)

-- disputes
(status, created_at DESC, dispute_id DESC)

-- payouts
(status, created_at DESC, payout_id DESC)

-- coupons
(active, created_at DESC, id DESC)

-- sellers
(approved, created_at DESC, id DESC)
```

Indexes are added with the service's migration system and, where supported by
the deployment process, built concurrently to reduce write blocking.

## Service ownership

- `order-service` owns cursor reads for orders and disputes.
- `user-service` owns cursor reads for users and seller approvals.
- `product-service` owns cursor reads for reviews and video moderation queues.
- `seller-finance-service` owns cursor reads for payouts.
- `coupon-service` owns cursor reads for coupons.

Each service owns its cursor codec integration, query, indexes, and contract
tests. The gateway only routes the endpoints and preserves the admin role
boundary.

## Frontend design

The existing `AdminQueueFrame` remains the shared composition root. Its
pagination prop changes from exact page totals to a discriminated state:

```typescript
type PaginationState =
  | { kind: "offset"; page: number; totalPages: number }
  | {
      kind: "cursor";
      hasMore: boolean;
      canGoBack: boolean;
      rangeStart: number;
      rangeEnd: number;
    };
```

Cursor mode renders:

- Previous and Next controls.
- Refresh.
- Page-size selector with 25, 50, and 100 options.
- `Showing 51–100` range text.
- `More results` instead of a fabricated total page count.

TanStack Query keys include resource, filters, sort, page size, and cursor.
The client keeps cursor history in memory for Previous navigation. Search,
status, sort, and page-size changes clear the cursor history and restart from
the first page. The current filter state remains in the URL.

The current page remains visible while the next page loads. The next cursor is
prefetched when `hasMore` is true. Stale requests are aborted when the filter
scope changes.

At mobile widths the admin queue uses a stacked record-card layout instead of
rendering the desktop table at a fixed wide width. High-value fields remain
visible; secondary fields stay in the existing record drawer. Pagination stays
within the content width and uses a compact `51–100 [Previous] [Next]` footer.

## Consistency and mutations

Admin lists are eventually consistent while records change. A cursor traversal
uses the stable composite boundary and may carry an `asOf` value so newly
created rows do not shift already traversed older pages. Existing rows that
change status can move between filtered queues; refresh starts a new traversal.

After an approve, reject, resolve, ban, unban, or payout action, the client
refetches the current cursor page while preserving filters and selection rules.
If the current page becomes empty, the UI moves to the nearest valid prior
cursor in history rather than issuing an unbounded fallback request.

## Failure handling

- Invalid or expired cursor: HTTP 400 with `cursor_invalid`.
- Cursor and filter mismatch: HTTP 400 with `cursor_scope_mismatch`.
- Database timeout: HTTP 503 with retryable metadata.
- Rate limit: HTTP 429 with `Retry-After`.
- Empty page after a mutation: show the nearest valid page and preserve filters.
- No cursor failure may fall back to an unbounded array fetch.

Retries are limited to safe GET requests, use the existing client policy, and
must not create a retry storm. The service should expose a bounded query timeout
and use the existing database pool limits.

## Observability

Add low-cardinality metrics:

```text
admin_list_requests_total{resource,status}
admin_list_request_duration_seconds{resource}
admin_list_cursor_invalid_total{resource,reason}
admin_list_page_size{resource}
admin_list_has_more_total{resource}
admin_list_db_timeout_total{resource}
```

Do not use user IDs, cursors, raw search text, or arbitrary URLs as metric
labels. Track p50/p95/p99 latency, error rate, cursor invalidation, timeout
rate, page-size distribution, filter usage, query-plan regressions, and pool
saturation.

## Rollout

1. Add shared frontend cursor schemas and a server cursor codec contract.
2. Add service cursor endpoints or cursor mode behind a feature flag.
3. Add composite indexes and verify query plans.
4. Update the shared admin frame and each queue's query options.
5. Add responsive mobile record cards and cursor controls.
6. Enable cursor mode for orders and users first, then the remaining queues.
7. Run browser, API, service, and query-plan verification against large fixtures.
8. Retire unbounded frontend calls and later remove offset compatibility when all
   consumers have migrated.

## Verification requirements

Unit and contract tests must prove:

- Cursor encoding/decoding rejects tampering, expiry, and scope mismatch.
- Equal timestamps are ordered without duplicates or omissions.
- `hasMore` is correct at exact-page and short-page boundaries.
- Filters and sort changes reset traversal state.
- All service queries use the intended composite order and limit.
- No admin frontend endpoint parses an unbounded array for a large list.

Browser tests must prove:

- Next and Previous cursor navigation.
- Refresh and filter reset behavior.
- Loading, empty, error, invalid-cursor, and mutation-refresh states.
- Mobile layout remains inside the viewport at 390px.
- Desktop table layout remains usable at 1280px.

Performance verification must use representative large fixtures and query-plan
inspection. The acceptance condition is that page latency does not grow
linearly with traversal depth and that no normal request performs an exact
count or unbounded fetch.

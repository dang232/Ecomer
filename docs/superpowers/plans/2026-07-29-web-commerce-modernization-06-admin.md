# VNShop Admin Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the admin area into a capability-aware operations console with clear marketplace metrics, consistent queue context, auditable decisions, and responsive record inspection.

**Architecture:** Admin routes compose a shared queue frame whose controls derive from typed endpoint capabilities rather than visual convention. Domain presenters own orders, coupons, users, seller review, moderation, disputes, payouts, and health data; selected records remain in URL-owned drawers and sensitive mutations wait for confirmed responses.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, React Hook Form 7, Zod 4, Recharts 2, shared DataTable/Drawer/Dialog primitives, Vitest, Playwright.

## Global Constraints

- Keep all admin routes under `/admin` and preserve ADMIN role enforcement.
- Group navigation into Overview, Commerce, Trust and Safety, Finance, Users, and System.
- Keep operational screens compact, scannable, and work-focused.
- Preserve the queue's URL filters and selected record while a mutation refetches.
- Render search, status, sorting, pagination, selection, reason, and evidence controls only when the endpoint supports them.
- Use server pagination only for admin orders, users, and video moderation where the current response and endpoint accept it.
- Do not add bulk actions because current admin endpoint contracts are single-record mutations.
- Require explicit confirmation for bans, cancellations, deactivation, approvals, rejection, resolution, refund, moderation, and payout decisions.
- Keep reason and evidence requirements aligned with exact endpoint request bodies.
- Never optimistically update orders, users, seller approvals, moderation, disputes, or payouts.
- Run the master plan Review Gate after every task.
- Do not stage or commit `fe/.ua/`.

---

### Task 1: Modernize Admin Shell And Marketplace Dashboard

**Files:**
- Modify: `fe/src/app/layouts/AdminLayout.tsx`
- Create: `fe/src/features/admin-dashboard/model/dashboard-view.ts`
- Create: `fe/src/features/admin-dashboard/model/dashboard-view.test.ts`
- Create: `fe/src/features/admin-dashboard/components/admin-dashboard.tsx`
- Create: `fe/src/features/admin-dashboard/components/marketplace-kpis.tsx`
- Create: `fe/src/features/admin-dashboard/components/revenue-chart.tsx`
- Create: `fe/src/features/admin-dashboard/components/top-seller-table.tsx`
- Create: `fe/src/features/admin-dashboard/components/operational-exceptions.tsx`
- Create: `fe/src/features/admin-dashboard/api/query-options.ts`
- Create: `fe/src/features/admin-dashboard/index.ts`
- Modify: `fe/src/app/pages/admin/AdminDashboard.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/admin-dashboard/components/admin-dashboard.test.tsx`
- Test: `fe/src/app/layouts/AdminLayout.test.tsx`

**Interfaces:**
- Consumes: dashboard summary, report, revenue, top product, top seller, export, and pending queue count endpoints.
- Produces: `AdminDashboardView`, URL-owned date/granularity state, grouped admin navigation, and explicit partial metrics.

- [ ] **Step 1: Write failing dashboard presenter tests**

Create `dashboard-view.test.ts`:

```ts
it("keeps unavailable metrics null and exposes operational exceptions", () => {
  const view = toAdminDashboardView({
    summary: null,
    report: null,
    revenue: [],
    topProducts: [],
    topSellers: [],
    counts: { sellers: 2, reviews: 3, disputes: 1, payouts: 4, video: 5 },
  });

  expect(view.kpis.gmvVnd).toBeNull();
  expect(view.exceptions).toEqual([
    { kind: "seller", count: 2, href: "/admin/sellers" },
    { kind: "review", count: 3, href: "/admin/reviews" },
    { kind: "video", count: 5, href: "/admin/video" },
    { kind: "dispute", count: 1, href: "/admin/disputes" },
    { kind: "payout", count: 4, href: "/admin/payouts" },
  ]);
});

it("maps only fields present in the dashboard report contract", () => {
  const view = toAdminDashboardView(reportFixture);
  expect(view.revenue[0]).toEqual({
    period: reportFixture.revenue.points[0].date,
    paidGmvVnd: reportFixture.revenue.points[0].paidGmv,
    refundedVnd: reportFixture.revenue.points[0].refundedAmount,
    realizedRevenueVnd: reportFixture.revenue.points[0].realizedRevenue,
  });
  expect(view.topProducts[0]).toMatchObject({ unitsSold: expect.any(Number) });
  expect(view.topSellers[0]).toMatchObject({ paidGmvVnd: expect.any(Number) });
});
```

- [ ] **Step 2: Run the presenter test and confirm it is missing**

Run: `pnpm exec vitest run src/features/admin-dashboard/model/dashboard-view.test.ts`

Working directory: `fe`

Expected: FAIL because the admin-dashboard feature does not exist.

- [ ] **Step 3: Define the dashboard view**

Use:

```ts
export interface AdminDashboardView {
  kpis: {
    gmvVnd: number | null;
    realizedRevenueVnd: number | null;
    orderCount: number | null;
    activeSellerCount: number | null;
    buyerCount: number | null;
  };
  revenue: readonly {
    period: string;
    paidGmvVnd: number;
    refundedVnd: number;
    realizedRevenueVnd: number;
  }[];
  topProducts: readonly { id: string; name: string; unitsSold: number }[];
  topSellers: readonly { id: string; name: string | null; paidGmvVnd: number }[];
  exceptions: readonly {
    kind: "seller" | "review" | "video" | "dispute" | "payout";
    count: number;
    href: string;
  }[];
}
```

Map these fields directly from `dashboardRevenuePointSchema`,
`dashboardTopProductSchema`, and `dashboardTopSellerSchema`. The current API
does not return per-period order counts, product revenue, product order counts,
or seller order counts; do not synthesize them. Never replace a failed metric
with zero. The route may render summary while report/top lists fail and must
label that as partial data.

- [ ] **Step 4: Build grouped navigation and date-controlled dashboard**

Admin navigation uses route links under exact groups. Queue badges show counts from best-effort queries and omit the badge when the count request fails.

Dashboard route state:

```ts
const dashboardRouteSchema = {
  from: routeParam.string({ defaultValue: "", maxLength: 10 }),
  to: routeParam.string({ defaultValue: "", maxLength: 10 }),
  granularity: routeParam.enum(["day", "week", "month"] as const, "day"),
};
```

Validate `from` and `to` as `YYYY-MM-DD` before query options consume them. Render:

```tsx
<PageContainer density="compact">
  <PageHeader title={t("admin.dashboard.title")} actions={<DashboardDateControls />} />
  <MarketplaceKpis values={view.kpis} />
  <RevenueChart points={view.revenue} />
  <div className="grid gap-6 xl:grid-cols-2">
    <TopSellerTable rows={view.topSellers} />
    <OperationalExceptions items={view.exceptions} />
  </div>
</PageContainer>
```

Export uses the existing `dashboardExport` blob endpoint and a Download icon button with tooltip.

- [ ] **Step 5: Verify dashboard states**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/admin-dashboard src/app/layouts/AdminLayout.test.tsx
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Capture 390x844 and 1440x900. Expected: navigation remains usable, chart dimensions are stable, and missing metrics remain unknown rather than zero.

- [ ] **Step 6: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): modernize admin dashboard"
```

### Task 2: Build Capability-Aware Queue Infrastructure And Commerce Views

**Files:**
- Create: `fe/src/features/admin/model/queue-capabilities.ts`
- Create: `fe/src/features/admin/model/queue-capabilities.test.ts`
- Create: `fe/src/features/admin/components/admin-queue-frame.tsx`
- Create: `fe/src/features/admin/components/admin-record-drawer.tsx`
- Modify: `fe/src/features/admin/index.ts`
- Create: `fe/src/features/admin-orders/model/order-view.ts`
- Create: `fe/src/features/admin-orders/components/order-queue.tsx`
- Create: `fe/src/features/admin-orders/components/order-decision-dialog.tsx`
- Create: `fe/src/features/admin-orders/api/query-options.ts`
- Create: `fe/src/features/admin-orders/index.ts`
- Create: `fe/src/features/admin-coupons/model/coupon-form.ts`
- Create: `fe/src/features/admin-coupons/components/coupon-list.tsx`
- Create: `fe/src/features/admin-coupons/components/coupon-editor.tsx`
- Create: `fe/src/features/admin-coupons/index.ts`
- Create: `fe/src/features/admin-users/components/user-queue.tsx`
- Create: `fe/src/features/admin-users/components/user-detail-drawer.tsx`
- Create: `fe/src/features/admin-users/api/query-options.ts`
- Create: `fe/src/features/admin-users/index.ts`
- Modify: `fe/src/shared/api/endpoints/admin.ts`
- Modify: `fe/src/shared/contracts/api/admin.ts`
- Modify: `fe/src/shared/contracts/domain-enums.ts`
- Modify: `fe/src/app/pages/admin/OrderManagement.tsx`
- Modify: `fe/src/app/pages/admin/CouponsManagement.tsx`
- Modify: `fe/src/app/pages/admin/CouponDialog.tsx`
- Modify: `fe/src/app/pages/admin/UserManagement.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/admin/components/admin-queue-frame.test.tsx`
- Test: `fe/src/features/admin-orders/components/order-queue.test.tsx`
- Test: `fe/src/features/admin-coupons/components/coupon-editor.test.tsx`
- Test: `fe/src/features/admin-users/components/user-queue.test.tsx`

**Interfaces:**
- Consumes: exact admin order, coupon, user, and buyer-order endpoints.
- Produces: `QueueCapabilities`, `ADMIN_QUEUE_CAPABILITIES`, reusable queue framing, and typed commerce/admin user workflows.

- [ ] **Step 1: Write failing capability rendering tests**

Create `queue-capabilities.test.ts`:

```ts
it("describes controls from current endpoint parameters", () => {
  expect(ADMIN_QUEUE_CAPABILITIES.orders).toEqual({
    search: true,
    status: true,
    sort: [],
    pagination: "server",
    selection: "single",
    actions: {
      cancel: { inputs: {} },
      refund: { inputs: { reason: "required" } },
      "change-status": { inputs: { status: "required" } },
    },
  });
  expect(ADMIN_QUEUE_CAPABILITIES.coupons.pagination).toBe("none");
  expect(ADMIN_QUEUE_CAPABILITIES.payouts.actions.submit.inputs).toEqual({
    providerReference: "required",
    attemptId: "required",
  });
  expect(ADMIN_QUEUE_CAPABILITIES.payouts.actions["legacy-fail"].rules).toEqual([
    {
      kind: "at-least-one",
      fields: ["externalReference", "evidenceHash"],
    },
  ]);
  expect(ADMIN_QUEUE_CAPABILITIES.users).toMatchObject({
    search: true,
    status: false,
    pagination: "server",
  });
});
```

`admin-queue-frame.test.tsx`:

```tsx
it("omits unsupported sort and bulk controls", () => {
  render(<AdminQueueFrame capabilities={ADMIN_QUEUE_CAPABILITIES.orders} {...props} />);
  expect(screen.queryByRole("combobox", { name: /sort/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: /select all/i })).not.toBeInTheDocument();
  expect(screen.getByRole("searchbox")).toBeVisible();
});
```

- [ ] **Step 2: Define exact queue capabilities**

Create:

```ts
export interface QueueCapabilities {
  search: boolean;
  status: boolean;
  sort: readonly string[];
  pagination: "server" | "client" | "none";
  selection: "single" | "multiple" | "none";
  actions: Readonly<Partial<Record<AdminQueueAction, MutationCapability>>>;
}

export interface MutationCapability {
  inputs: Readonly<
    Partial<Record<MutationInput, "required" | "optional">>
  >;
  rules?: readonly MutationValidationRule[];
}

export type MutationInput =
  | "reason" | "status" | "adminResolution" | "providerReference"
  | "attemptId" | "evidence" | "externalReference"
  | "evidenceHash" | "maskedDestinationConfirmed";

export interface MutationValidationRule {
  kind: "at-least-one";
  fields: readonly MutationInput[];
}

export type AdminQueueAction =
  | "cancel" | "refund" | "change-status" | "deactivate" | "ban" | "unban"
  | "approve" | "reject" | "approve-appeal" | "reject-appeal" | "resolve"
  | "submit" | "unknown" | "paid" | "legacy-complete" | "legacy-fail";

export const ADMIN_QUEUE_CAPABILITIES = {
  orders: {
    search: true, status: true, sort: [], pagination: "server", selection: "single",
    actions: {
      cancel: { inputs: {} },
      refund: { inputs: { reason: "required" } },
      "change-status": { inputs: { status: "required" } },
    },
  },
  coupons: {
    search: false, status: false, sort: [], pagination: "none", selection: "single",
    actions: { deactivate: { inputs: {} } },
  },
  users: {
    search: true, status: false, sort: [], pagination: "server", selection: "single",
    actions: {
      ban: { inputs: {} },
      unban: { inputs: {} },
    },
  },
  sellers: {
    search: true, status: false, sort: [], pagination: "none", selection: "single",
    actions: {
      approve: { inputs: {} },
      reject: { inputs: { reason: "required" } },
    },
  },
  reviews: {
    search: true, status: false, sort: [], pagination: "none", selection: "single",
    actions: {
      approve: { inputs: {} },
      reject: { inputs: { reason: "required" } },
    },
  },
  disputes: {
    search: true, status: false, sort: [], pagination: "none", selection: "single",
    actions: { resolve: { inputs: { adminResolution: "required" } } },
  },
  payouts: {
    search: true, status: true, sort: [], pagination: "none", selection: "single",
    actions: {
      approve: { inputs: { reason: "required" } },
      reject: { inputs: { reason: "required" } },
      submit: {
        inputs: { providerReference: "required", attemptId: "required" },
      },
      unknown: { inputs: { reason: "required" } },
      paid: {
        inputs: { providerReference: "required", evidence: "required" },
      },
      "legacy-complete": {
        inputs: {
          reason: "required",
          externalReference: "required",
          evidenceHash: "required",
          maskedDestinationConfirmed: "required",
        },
      },
      "legacy-fail": {
        inputs: {
          reason: "required",
          externalReference: "optional",
          evidenceHash: "optional",
        },
        rules: [{
          kind: "at-least-one",
          fields: ["externalReference", "evidenceHash"],
        }],
      },
    },
  },
  video: {
    search: false, status: false, sort: [], pagination: "server", selection: "single",
    actions: {
      approve: { inputs: {} },
      reject: { inputs: { reason: "required" } },
      "approve-appeal": { inputs: {} },
      "reject-appeal": { inputs: { reason: "required" } },
    },
  },
} as const satisfies Record<string, QueueCapabilities>;
```

- [ ] **Step 3: Implement the shared queue frame**

`AdminQueueFrame` accepts title, capabilities, toolbar state, async state, rows,
table columns, pagination, selected ID, and drawer content. Its toolbar derives
only queue-level fields such as search, status, sort, selection, and pagination.
Each mutation dialog receives the selected action's
`MutationCapability`; controls and Zod validation derive from exact required or
optional input names plus cross-field rules, never from a queue-wide boolean.
Record selection writes `selected` into the route; closing the drawer removes
only `selected`, preserving query/page/status.

```tsx
<PageContainer density="compact">
  <PageHeader title={title} description={description} actions={headerActions} />
  <TableToolbar>
    {capabilities.search ? <SearchField value={q} onSubmit={onSearch} /> : null}
    {capabilities.status ? <StatusFilter value={status} onChange={onStatus} /> : null}
    {capabilities.sort.length > 0 ? <SortMenu options={capabilities.sort} /> : null}
  </TableToolbar>
  <DataTable rows={rows} columns={columns} selectedId={selectedId} onRowOpen={onRowOpen} />
  {capabilities.pagination === "server" ? <Pagination {...pagination} /> : null}
  <AdminRecordDrawer selectedId={selectedId}>{drawerContent}</AdminRecordDrawer>
</PageContainer>
```

- [ ] **Step 4: Modernize admin orders**

The route owns `q`, `status`, `page`, and `selected`; map page 1 to endpoint page 0. Rows show stable order number, status, buyer, seller, item count, total, and date. The drawer exposes current state and only these existing actions:

- Cancel: confirmation, no reason field because `adminCancelOrder(id)` accepts none.
- Refund: required reason passed to `adminRefundOrder(id, reason)`.
- Change status: enum choice passed to `adminChangeOrderStatus(id, status)`.

The change-status selector is limited to backend-admin-settable values:

```ts
const ADMIN_SETTABLE_ORDER_STATUSES = ["ACCEPTED", "PACKED", "SHIPPED", "CANCELLED"] as const;
```

Do not optimistically change the row. On success invalidate the exact list prefix while keeping route state.

- [ ] **Step 5: Modernize coupon management**

Define a Zod form matching `CouponWriteBody`:

```ts
export const couponFormSchema = z.object({
  code: z.string().trim().min(3).max(40).transform((value) => value.toUpperCase()),
  type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
  value: z.number().min(0),
  minOrderValue: z.number().min(0).optional(),
  maxDiscount: z.number().positive().optional(),
  maxUses: z.number().int().positive(),
  perUserLimit: z.number().int().positive().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime(),
});
```

Add a refinement that requires a positive value for `PERCENT` and `FIXED`,
caps percentage at 100, and permits zero for `FREE_SHIPPING` because shipping
waiver calculation ignores the numeric discount value. Extend
`COUPON_TYPES` and `CouponWriteBody` with `FREE_SHIPPING` and
`perUserLimit`; use canonical `validFrom`/`validUntil` field names. Infer the
write body from a schema instead of maintaining a second interface.

Use the drawer form for creation and a read-only detail drawer for existing
coupons. `active` is response state, not a write input, so render it as status
only. Deactivate requires confirmation. The response omits `perUserLimit`, and
the backend update path replaces an omitted value with `1`; therefore do not
render an edit command or call `adminUpdateCoupon` in this frontend-only scope.
Expose `perUserLimit` on create. A future editor requires either that field in
`CouponResponse` or backend update semantics that preserve it when absent. Do
not render pagination, search, or bulk deactivation.

- [ ] **Step 6: Modernize user management**

The route owns `q`, `page`, and `selected`. The drawer combines account data and `adminUserOrders(buyerId)`. Ban/unban controls depend on `user.banned`; both require confirmation but no reason field because endpoint bodies accept none. Keep order-history failure as partial drawer state.

- [ ] **Step 7: Verify commerce and user queues**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/admin src/features/admin-orders src/features/admin-coupons src/features/admin-users src/app/pages/admin/OrderManagement.test.tsx
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use Playwright to deep-link a selected order/user, paginate, search, change
order status, refund with reason, create/inspect/deactivate a coupon, prove no
existing-coupon edit command is rendered, ban/unban a user, and navigate back
without losing queue position.

- [ ] **Step 8: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): standardize admin commerce queues"
```

### Task 3: Modernize Seller Review, Moderation, And Disputes

**Files:**
- Create: `fe/src/features/admin-sellers/components/seller-approval-queue.tsx`
- Create: `fe/src/features/admin-sellers/components/seller-application-drawer.tsx`
- Create: `fe/src/features/admin-sellers/api/query-options.ts`
- Create: `fe/src/features/admin-sellers/index.ts`
- Create: `fe/src/features/admin-reviews/components/review-moderation-queue.tsx`
- Create: `fe/src/features/admin-reviews/index.ts`
- Create: `fe/src/features/admin-video/model/video-queue-view.ts`
- Create: `fe/src/features/admin-video/components/video-moderation-queue.tsx`
- Create: `fe/src/features/admin-video/components/video-preview-drawer.tsx`
- Create: `fe/src/features/admin-video/components/video-decision-dialog.tsx`
- Create: `fe/src/features/admin-video/api/query-options.ts`
- Create: `fe/src/features/admin-video/index.ts`
- Create: `fe/src/features/admin-disputes/components/dispute-queue.tsx`
- Create: `fe/src/features/admin-disputes/components/dispute-resolution-dialog.tsx`
- Create: `fe/src/features/admin-disputes/index.ts`
- Modify: `fe/src/shared/api/endpoints/admin.ts`
- Modify: `fe/src/shared/contracts/api/admin.ts`
- Modify: `fe/src/shared/contracts/api/admin.test.ts`
- Modify: `fe/src/app/pages/admin/SellersApproval.tsx`
- Modify: `fe/src/app/pages/admin/SellerApplicationDetail.tsx`
- Modify: `fe/src/app/pages/admin/ReviewsModeration.tsx`
- Modify: `fe/src/app/pages/admin/VideoModerationPanel.tsx`
- Modify: `fe/src/app/pages/admin/VideoModeration.tsx`
- Modify: `fe/src/app/pages/admin/VideoAppeals.tsx`
- Modify: `fe/src/app/pages/admin/DisputesQueue.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/admin-sellers/components/seller-approval-queue.test.tsx`
- Test: `fe/src/features/admin-reviews/components/review-moderation-queue.test.tsx`
- Test: `fe/src/features/admin-video/components/video-moderation-queue.test.tsx`
- Test: `fe/src/features/admin-disputes/components/dispute-queue.test.tsx`

**Interfaces:**
- Consumes: seller, review, video queue/preview/appeal, and dispute endpoints.
- Produces: consistent trust-and-safety queue views with exact decision inputs and URL-owned record context.

- [ ] **Step 1: Write failing decision requirement tests**

```tsx
it("requires a reason for seller, review, video, and appeal rejection", async () => {
  render(
    <DecisionDialog
      kind="reject"
      capability={ADMIN_QUEUE_CAPABILITIES.sellers.actions.reject}
      onConfirm={onConfirm}
    />,
  );
  await user.click(screen.getByRole("button", { name: /confirm rejection/i }));
  expect(screen.getByText(/reason is required/i)).toBeVisible();
  expect(onConfirm).not.toHaveBeenCalled();
});

it("requires an admin resolution for a dispute", async () => {
  render(<DisputeResolutionDialog dispute={dispute} onConfirm={onConfirm} />);
  await user.click(screen.getByRole("button", { name: /resolve/i }));
  expect(onConfirm).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement seller approval**

Seller list supports `q` but no pagination. Rows show shop identity, application status, timing, masked destination bank/last4, verification state, tier, and vacation mode when returned. Approve needs confirmation. Reject requires `{ reason }`. The selected seller remains in `?selected=` while the list refetches.

- [ ] **Step 3: Implement review moderation**

Pending reviews support `q` but no pagination. Rows show product context, buyer, rating, comment, media, and created date. Approve needs confirmation. Reject requires `{ reason }`. Do not show bulk moderation or a reply action.

- [ ] **Step 4: Implement video moderation and appeals**

Moderation route state owns page and selected record. Use `adminVideoModerationQueue({ page: page - 1, size: 20 })`; fetch preview only when the drawer is open. Approve needs confirmation; reject requires reason.

Change `adminVideoAppealsQueue` to accept `{ page, size }` and pass both to the
pageable backend. The appeal tab owns one-based `appealPage` in the URL, maps it
to backend page zero, and renders server pagination from the decoded Spring
page. Approve appeal needs confirmation; reject appeal requires reason. Video
preview has stable 16:9 dimensions and explicit loading/error states.

- [ ] **Step 5: Implement dispute resolution**

Disputes support `q` but no pagination. Drawer shows order/return IDs, buyer reason, seller response, parties, current status, and existing resolution. Resolve requires a non-empty `adminResolution` and calls:

```ts
adminResolveDispute(dispute.id, { adminResolution });
```

Correct the current payout-status reuse in `shared/contracts/api/admin.ts`:

```ts
const disputeStatusSchema = z.enum(["OPEN", "RESOLVED"]);

// Inside disputeSchema:
status: disputeStatusSchema,
```

Return `status: raw.status` from the transform and add a schema test for both values. Do not pass dispute status through `parsePayoutStatus`.

Do not expose refund or message actions from the dispute drawer unless their existing endpoints are wired with a verified identifier.

- [ ] **Step 6: Verify trust and safety workflows**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/admin-sellers src/features/admin-reviews src/features/admin-video src/features/admin-disputes src/app/pages/admin/VideoModerationPanel.test.tsx
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use Playwright for approve/reject seller, approve/reject review, video preview
and decision, navigating beyond the first appeal page, appeal decision, and
dispute resolution. Assert every rejection and resolution sends the entered
reason and preserves queue context.

- [ ] **Step 7: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): modernize trust and safety queues"
```

### Task 4: Modernize Finance Reconciliation And System Health

**Files:**
- Create: `fe/src/features/admin-payouts/model/payout-view.ts`
- Create: `fe/src/features/admin-payouts/model/payout-view.test.ts`
- Create: `fe/src/features/admin-payouts/components/payout-queue.tsx`
- Create: `fe/src/features/admin-payouts/components/payout-decision-dialog.tsx`
- Create: `fe/src/features/admin-payouts/api/query-options.ts`
- Create: `fe/src/features/admin-payouts/index.ts`
- Create: `fe/src/features/admin-payments/model/vietqr-confirmation.ts`
- Create: `fe/src/features/admin-payments/components/vietqr-confirmation-panel.tsx`
- Create: `fe/src/features/admin-payments/components/vietqr-confirmation-panel.test.tsx`
- Create: `fe/src/features/admin-payments/index.ts`
- Modify: `fe/src/shared/api/endpoints/admin.ts`
- Modify: `fe/src/shared/contracts/api/admin.ts`
- Modify: `fe/src/shared/contracts/api/admin.test.ts`
- Modify: `fe/src/shared/contracts/domain-enums.ts`
- Modify: `fe/src/app/pages/admin/PayoutsQueue.tsx`
- Create: `fe/src/features/admin-health/model/health-view.ts`
- Create: `fe/src/features/admin-health/components/system-health.tsx`
- Create: `fe/src/features/admin-health/index.ts`
- Modify: `fe/src/app/pages/admin/SystemHealth.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/admin-payouts/components/payout-queue.test.tsx`
- Test: `fe/src/features/admin-payouts/components/payout-decision-dialog.test.tsx`
- Test: `fe/src/features/admin-health/components/system-health.test.tsx`
- Test: `fe/src/app/pages/admin/PayoutsQueue.test.tsx`

**Interfaces:**
- Consumes: pending/completed payout lists, exact status-specific payout
  actions, manual VietQR confirmation, and validated service-health checks.
- Produces: a typed payout action matrix, exact auditable decision forms,
  manual payment reconciliation, URL status selection, and compact service
  availability.

- [ ] **Step 1: Write failing payout state and evidence tests**

```tsx
it("exposes only transitions accepted from the current payout status", () => {
  expect(actionsForPayout({ ...payout, status: "REQUESTED" }, "admin-1")).toEqual([
    "approve",
    "reject",
  ]);
  expect(actionsForPayout({ ...payout, status: "SUBMITTING" }, "admin-2")).toEqual([
    "submit",
    "unknown",
    "paid",
  ]);
  expect(actionsForPayout({ ...payout, status: "PAID" }, "admin-2")).toEqual([]);
});

it("requires every field accepted by legacy manual completion", async () => {
  render(<PayoutDecisionDialog payout={legacyPayout} action="legacy-complete" onConfirm={onConfirm} />);
  await user.type(screen.getByLabelText(/reason/i), "Bank transfer verified");
  await user.type(screen.getByLabelText(/external reference/i), "bank-ref-123");
  await user.click(screen.getByRole("button", { name: /complete payout/i }));
  expect(screen.getByText(/evidence hash is required/i)).toBeVisible();
  expect(onConfirm).not.toHaveBeenCalled();
});

it("submits complete evidence without a raw destination", async () => {
  await submitLegacyComplete({
    reason: "Bank transfer verified",
    externalReference: "bank-ref-123",
    evidenceHash: "sha256:evidence",
    maskedDestinationConfirmed: true,
  });
  expect(onConfirm).toHaveBeenCalledWith({
    reason: "Bank transfer verified",
    evidence: {
      externalReference: "bank-ref-123",
      evidenceHash: "sha256:evidence",
      maskedDestinationConfirmed: true,
    },
  });
});
```

- [ ] **Step 2: Preserve wire statuses and implement the exact action matrix**

The route owns `status=pending|completed`, `q`, and `selected`. It switches between existing pending and completed endpoints; no pagination or sort controls. Rows show seller, amount, status, request time, completion actor/time, and masked destination metadata when available.

Replace the lossy payout parser that maps `PENDING -> REQUESTED` and
`COMPLETED -> PAID` with a Zod enum preserving all current wire values:

```ts
export const payoutStatusSchema = z.enum([
  "REQUESTED", "APPROVED", "SUBMITTING", "SUBMITTED", "PAID", "UNKNOWN",
  "REJECTED", "CANCELLED", "REVERSED", "PENDING", "COMPLETED", "FAILED",
]);
```

Extend `adminPayoutSchema` with the response's `idempotencyKey`, `approvedBy`,
`paidBy`, `externalReference`, and `evidenceReference`. Keep display grouping
separate from wire status.

Define and exhaustively test:

```ts
export const PAYOUT_ACTIONS = {
  REQUESTED: ["approve", "reject"],
  APPROVED: ["reject"],
  SUBMITTING: ["submit", "unknown", "paid"],
  SUBMITTED: ["unknown", "paid"],
  UNKNOWN: ["paid"],
  PENDING: ["approve", "reject", "legacy-complete", "legacy-fail"],
  PAID: [],
  REJECTED: [],
  CANCELLED: [],
  REVERSED: [],
  COMPLETED: [],
  FAILED: [],
} as const satisfies Record<PayoutStatus, readonly PayoutAction[]>;
```

Filter `paid` when `approvedBy` equals the current admin ID because the backend
enforces separation of duties. Do not render a "submit" action for `APPROVED`:
the exposed submit endpoint requires `SUBMITTING`, while no begin-submission
endpoint is exposed to the frontend.

Add typed endpoint wrappers matching the exact controller inputs:

- approve/reject/unknown: required `reason` query parameter;
- submit: required `providerReference` and `attemptId` query parameters;
- paid: required `providerReference` and `evidence` query parameters;
- legacy complete: body with non-empty reason, external reference, evidence
  hash, and `maskedDestinationConfirmed: true`;
- legacy fail: body with non-empty reason and nested `evidence` containing at
  least one non-empty `externalReference` or `evidenceHash`. Never send the
  server-derived response field `evidenceReference` as request input.

Build query strings with `URLSearchParams`; never interpolate raw operator text.
Wait for the server response, invalidate both pending and completed keys, and
preserve the selected ID until the refreshed record leaves the current queue.

- [ ] **Step 3: Add honest manual VietQR reconciliation**

The backend exposes idempotent
`POST /admin/vietqr/confirm/{paymentId}` but no admin list/read queue. Add a
compact manual reconciliation panel in the Finance view, not a fabricated
queue. Its Zod form accepts a required UUID payment ID and optional trimmed bank
reference. The command is disabled while pending and shows the decoded payment
status/order ID after confirmation.

Do not claim the app can discover pending VietQR payments. The operator enters
the payment ID from the bank transfer reference. Add a typed
`adminConfirmVietQr(paymentId, body)` wrapper and tests for invalid UUID,
single-submit locking, optional bank reference, completed response, and
server-error recovery.

- [ ] **Step 4: Implement compact validated system health**

`SystemHealth` from Plan 02 already parses `{ status }`. Move presentation into:

```ts
export interface ServiceHealthView {
  id: string;
  label: string;
  status: "up" | "down" | "checking";
  latencyMs?: number;
  lastCheckedAt?: string;
}
```

Measure latency with `performance.now()` around each request. Render a compact data list with service, availability text/icon, latency, and last check. Refresh is a Lucide RefreshCw icon button with tooltip. Abort the previous run before starting another and disable refresh while checks are active.

- [ ] **Step 5: Verify finance, payment reconciliation, and health**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/admin-payouts src/features/admin-payments src/features/admin-health src/shared/contracts/api/admin.test.ts src/app/pages/admin/PayoutsQueue.test.tsx
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use Playwright to approve/reject a requested payout; exercise submit, unknown,
and paid only from compatible fixtures; complete/fail a legacy PENDING record
with exact evidence; confirm VietQR by payment ID; switch queue status; search;
inspect audit fields; refresh health; and render one unavailable service without
collapsing the table. Assert incompatible payout actions are absent.

- [ ] **Step 6: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): modernize finance reconciliation"
```

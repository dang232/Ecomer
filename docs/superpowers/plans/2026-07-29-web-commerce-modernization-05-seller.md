# VNShop Seller Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Plan Progress

| # | Task | Status | Commit |
|---|---|---|---|
| 1 | Modernize Seller Shell And Dashboard | **shipped** | `12fa1b1a feat(fe): modernize seller dashboard` |
| 2 | Refactor Seller Products And Product Editor | **shipped** | `5f9660bb feat(fe): modernize seller product workflow` + `b10dcee8 fix(fe): clear seller queue a11y + editor async lint` |
| 3 | Standardize Seller Orders And Review Inbox | **shipped** | `f8c13551 feat(fe): standardize seller work queues` |
| 4 | Clarify Seller Wallet And Supported Settings | **shipped** | `c8c71fbb feat(fe): clarify seller finance and settings` + `1f0f7558 fix(fe): merge duplicate seller.settings i18n blocks + cover in-flight payout` (code-review follow-up) |

**Note on `b7e411de`:** That commit shipped buyer-facing cart + checkout feature extraction (Plan 04), not seller work. The seller plan's Tasks 2/3/4 still need their own extraction commits.

**Plan 05 final state (2026-07-31):** All 4 tasks shipped. Verification gates (vitest 42 tests / 7 files, tsc exit 0, eslint 0 errors) green after `b10dcee8`.

**Goal:** Turn the seller area into a restrained, route-driven operational console for revenue, products, fulfillment, reviews, payouts, and supported account information.

**Architecture:** Each seller route owns its query options and URL state through the seller feature public interface. Typed presenters convert decoded data into compact KPI, table, editor, and queue views; actions render only when a current endpoint supports them and financial mutations retain stable idempotency.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, React Hook Form 7, Zod 4, Recharts 2, shared UI primitives, Vitest, Playwright.

## Global Constraints

- Keep seller routes under `/seller` and preserve role-gated access.
- Use persistent desktop navigation, compact header, and task-first mobile navigation.
- Prefer dense lists, tables, drawers, and forms over promotional cards.
- Keep query parameters in the URL when search, page, date window, or selected record must survive navigation.
- Do not show seller-order status tabs beyond the current endpoint's pending fulfillment dataset.
- Do not show review rating filters because `/reviews/seller/me` does not accept a rating parameter.
- Do not show editable seller settings because the current frontend contract exposes no seller-profile update endpoint.
- Keep product create, update, publish, media upload, order accept/reject/ship, and payout semantics unchanged.
- Treat the seller-filtered public catalog as ACTIVE-only. Do not claim it lists
  all drafts; recover only a draft created in the current browser session until
  a seller-scoped list/detail contract exists.
- Seller order rejection accepts no request body. Require confirmation, but do
  not collect or claim to store a rejection reason.
- Preserve payout idempotency across retries and clear the key only after success or explicit cancellation.
- Run the master plan Review Gate after every task.
- Do not stage or commit `fe/.ua/`.

---

### Task 1: Modernize Seller Shell And Dashboard

**Files:**
- Modify: `fe/src/app/layouts/SellerLayout.tsx`
- Create: `fe/src/features/seller/model/dashboard-view.ts`
- Create: `fe/src/features/seller/model/dashboard-view.test.ts`
- Create: `fe/src/features/seller/components/seller-dashboard.tsx`
- Create: `fe/src/features/seller/components/seller-kpi-strip.tsx`
- Create: `fe/src/features/seller/components/revenue-chart.tsx`
- Create: `fe/src/features/seller/components/urgent-task-list.tsx`
- Modify: `fe/src/features/seller/api/query-options.ts`
- Modify: `fe/src/features/seller/index.ts`
- Modify: `fe/src/shared/contracts/api/seller.ts`
- Modify: `fe/src/shared/api/endpoints/users.ts`
- Test: `fe/src/shared/api/endpoints/users.test.ts`
- Modify: `fe/src/app/pages/seller/SellerDashboard.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/seller/components/seller-dashboard.test.tsx`
- Test: `fe/src/app/layouts/SellerLayout.test.tsx`

**Interfaces:**
- Consumes: seller profile, public seller statistics, pending orders, wallet, payouts, and revenue-series endpoints.
- Produces: `SellerDashboardView`, URL-owned `days`, compact seller navigation, and truthful partial dashboard states.

- [ ] **Step 1: Write failing dashboard presenter tests**

Create `dashboard-view.test.ts`:

```ts
it("derives urgent work and keeps missing metrics explicit", () => {
  const view = toSellerDashboardView({
    profile: {
      id: "s-1",
      shopName: "Shop A",
      bankName: "Vietcombank",
      approved: true,
      tier: "STANDARD",
      vacationMode: false,
      destination: null,
    },
    publicStats: null,
    pendingOrders: [{ id: "sub-1", status: "PENDING_ACCEPTANCE", items: [] }],
    wallet: { balance: 500_000 },
    payouts: [{ id: "pay-1", status: "FAILED", amount: 100_000 }],
    revenue: [],
  });

  expect(view.shopName).toBe("Shop A");
  expect(view.kpis.productCount).toBeNull();
  expect(view.urgentTasks.map((task) => task.kind)).toEqual(["order", "payout"]);
});

it("uses the requested revenue window without synthesizing points", () => {
  const view = toSellerDashboardView({ ...input, revenue: [{ date: "2026-07-29", revenue: 20, orderCount: 1 }] });
  expect(view.revenue).toEqual([{ date: "2026-07-29", revenueVnd: 20, orders: 1 }]);
});
```

- [ ] **Step 2: Run the presenter test and confirm it is missing**

Run: `pnpm exec vitest run src/features/seller/model/dashboard-view.test.ts`

Working directory: `fe`

Expected: FAIL because the dashboard presenter does not exist.

- [ ] **Step 3: Implement typed dashboard data**

Define:

```ts
export interface SellerDashboardView {
  shopName: string;
  kpis: {
    revenueVnd: number | null;
    orderCount: number | null;
    productCount: number | null;
    rating: number | null;
    availableBalanceVnd: number | null;
  };
  revenue: readonly { date: string; revenueVnd: number; orders: number }[];
  urgentTasks: readonly {
    id: string;
    kind: "order" | "inventory" | "payout";
    label: string;
    href: string;
  }[];
}
```

Revenue and order count come from the selected `sellerRevenue({ days })` series. Product count and rating remain `null` when public stats fail. Pending order and failed payout tasks link to `/seller/orders?selected=<id>` and `/seller/wallet`.

Define `sellerProfileSchema` from the exact `/sellers/me`
`SellerProfileResponse`: `id`, `shopName`, nullable `bankName`, `approved`,
`tier`, `vacationMode`, and nullable masked destination
`{ destinationId, bankName, last4, verificationState }`. Infer
`SellerProfile` from it and change `sellerProfile()` to decode that schema,
never `userProfileSchema`. Add endpoint tests proving seller fields survive
decoding and plaintext account numbers are neither expected nor rendered.

- [ ] **Step 4: Implement a restrained responsive shell**

Desktop navigation groups Overview, Commerce, Finance, and Account with route links and compact badges. Mobile uses a top bar plus a four-item bottom navigation for Dashboard, Orders, Products, and Wallet; Reviews and Settings remain in an overflow menu. Use `aria-current` from NavLink and 44px controls.

The dashboard composition is:

```tsx
<PageContainer density="compact">
  <PageHeader
    title={view.shopName}
    description={t("seller.dashboard.subtitle")}
    actions={<SegmentedControl value={days} options={dayOptions} onChange={setDaysInUrl} />}
  />
  <SellerKpiStrip values={view.kpis} />
  <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
    <RevenueChart points={view.revenue} />
    <UrgentTaskList tasks={view.urgentTasks} />
  </div>
</PageContainer>
```

The date options are 7, 30, and 90 days, all accepted by the current backend. Recharts receives a stable chart height and localized tooltip formatters.

- [ ] **Step 5: Verify seller shell and dashboard**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/seller/model/dashboard-view.test.ts src/features/seller/components/seller-dashboard.test.tsx src/app/layouts/SellerLayout.test.tsx src/shared/api/endpoints/users.test.ts
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Capture 390x844 and 1440x900. Expected: compact navigation, no nested cards, no chart resizing, and partial data does not collapse into zero.

- [ ] **Step 6: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): modernize seller dashboard"
```

### Task 2: Refactor Seller Products And Product Editor

**Files:**
- Create: `fe/src/features/seller-products/model/product-form.ts`
- Create: `fe/src/features/seller-products/model/product-form.test.ts`
- Create: `fe/src/features/seller-products/model/product-list-view.ts`
- Create: `fe/src/features/seller-products/model/draft-recovery.ts`
- Create: `fe/src/features/seller-products/model/draft-recovery.test.ts`
- Create: `fe/src/features/seller-products/components/product-list.tsx`
- Create: `fe/src/features/seller-products/components/product-editor-drawer.tsx`
- Create: `fe/src/features/seller-products/components/product-basic-fields.tsx`
- Create: `fe/src/features/seller-products/components/product-media-fields.tsx`
- Create: `fe/src/features/seller-products/components/product-variant-fields.tsx`
- Create: `fe/src/features/seller-products/components/product-publication.tsx`
- Create: `fe/src/features/seller-products/api/query-options.ts`
- Create: `fe/src/features/seller-products/index.ts`
- Modify: `fe/src/app/pages/seller/SellerProducts.tsx`
- Modify: `fe/src/app/components/seller-product-modal.tsx`
- Modify: `fe/src/shared/api/endpoints/products.ts`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/seller-products/components/product-list.test.tsx`
- Test: `fe/src/features/seller-products/components/product-editor-drawer.test.tsx`

**Interfaces:**
- Consumes: ACTIVE-only seller-filtered catalog query and current product create,
  update, publish, soft-delete, image upload, and image activation endpoints.
- Produces: `sellerProductFormSchema`, `SellerProductForm`,
  `toSellerProductWriteBody`, versioned current-session draft recovery,
  URL-owned active-list/editor state, and focused editor sections.

- [ ] **Step 1: Write failing schema and mapping tests**

Create `product-form.test.ts`:

```ts
it("rejects an invalid variant beside the variant fields", () => {
  const result = sellerProductFormSchema.safeParse({
    name: "Phone",
    description: "",
    categoryId: "phones",
    brand: "VN",
    tags: [],
    images: [],
    variants: [{ sku: "", name: "Blue", priceAmount: -1, stockQuantity: -2 }],
  });
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.flatten().fieldErrors.variants).toBeDefined();
  }
});

it("maps form values to the existing write contract", () => {
  expect(toSellerProductWriteBody(validForm)).toEqual({
    name: validForm.name,
    description: validForm.description,
    categoryId: validForm.categoryId,
    brand: validForm.brand,
    tags: validForm.tags,
    images: validForm.images,
    variants: validForm.variants.map((variant) => ({ ...variant, priceCurrency: "VND" })),
  });
});
```

- [ ] **Step 2: Run tests and confirm the form model is missing**

Run: `pnpm exec vitest run src/features/seller-products/model/product-form.test.ts`

Working directory: `fe`

Expected: FAIL because the seller-products feature does not exist.

- [ ] **Step 3: Implement the form schema from the endpoint input**

Use:

```ts
export const sellerProductFormSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5_000),
  categoryId: z.string().trim().min(1),
  brand: z.string().trim().max(100),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().trim().max(200).optional(),
    sortOrder: z.number().int().min(0),
  })).max(12),
  variants: z.array(z.object({
    sku: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(100),
    priceAmount: z.number().min(0),
    stockQuantity: z.number().int().min(0),
    imageUrl: z.string().url().optional(),
  })).min(1),
});

export type SellerProductForm = z.infer<typeof sellerProductFormSchema>;
```

Use `zodResolver(sellerProductFormSchema)` with React Hook Form. Reuse `SellerProductWriteBody` as the mapper return type instead of duplicating the endpoint contract.

- [ ] **Step 4: Make product list state URL-owned**

Use `?q=<text>&page=<one-based>&selected=<product-id>&mode=create|edit`.
Debounce only the query request; write committed search to the URL on submit.
`ProductList` uses `DataTable<ProductListRow>` with product media, publication,
price range, aggregate stock, sold count when present, and edit/delete icon
actions.

Document in the route and test names that this endpoint returns ACTIVE catalog
products only. Deep-linked editing is supported for an ACTIVE row or a
session-recovered draft, not for an arbitrary unpublished product ID.

Add a typed `sellerProductDelete(id)` wrapper for
`DELETE /sellers/me/products/{id}`. Delete requires explicit confirmation,
waits for `204`, and invalidates the seller product list. Do not optimistically
remove the row.

- [ ] **Step 5: Replace the oversized modal with a focused drawer**

`ProductEditorDrawer` uses four visible sections in one form:

1. Basic information
2. Media
3. Variants, pricing, and inventory
4. Publication

Use a sticky drawer footer with Cancel and Save. On close with `formState.isDirty`, open `AlertDialog` with Discard and Continue editing. Image removal before save changes form state only; destructive activation or replacement calls require confirmation.

Creation returns a `DRAFT` product that the ACTIVE-only list cannot refetch.
Immediately persist a versioned Zod record under a seller-specific
`sessionStorage` key containing the returned product ID and validated form
values. Keep the editor open on a publication recovery surface with Publish,
Continue editing, and Delete draft. Publish calls `sellerProductPublish`;
delete calls `sellerProductDelete`. Clear recovery only after either succeeds.
On reload, decode the record and restore that one draft. A malformed record is
removed. Do not synthesize a general draft list or merge session data into
catalog counts.

Keep `seller-product-modal.tsx` as a temporary re-export:

```ts
export { ProductEditorDrawer as SellerProductModal } from "@/features/seller-products";
```

Remove this compatibility file in Plan 07.

- [ ] **Step 6: Verify product workflows**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/seller-products
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use Playwright to create a draft, reload and recover it, edit/upload media,
publish it, search/paginate the ACTIVE list, deep-link the published editor,
delete a product after confirmation, and reject accidental close. Simulate
publish failure and prove the draft recovery remains. Expected: invalid variant
fields remain visible and no arbitrary server draft is implied.

- [ ] **Step 7: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): modernize seller product workflow"
```

### Task 3: Standardize Seller Orders And Review Inbox

**Files:**
- Create: `fe/src/features/seller-orders/model/order-queue-view.ts`
- Create: `fe/src/features/seller-orders/model/order-queue-view.test.ts`
- Create: `fe/src/features/seller-orders/components/order-queue.tsx`
- Create: `fe/src/features/seller-orders/components/order-detail-drawer.tsx`
- Create: `fe/src/features/seller-orders/components/reject-order-dialog.tsx`
- Create: `fe/src/features/seller-orders/components/ship-order-dialog.tsx`
- Create: `fe/src/features/seller-orders/api/query-options.ts`
- Create: `fe/src/features/seller-orders/index.ts`
- Modify: `fe/src/app/pages/seller/SellerOrders.tsx`
- Modify: `fe/src/app/pages/seller/ShipDialog.tsx`
- Modify: `fe/src/shared/api/endpoints/orders.ts`
- Modify: `fe/src/shared/contracts/api/order.ts`
- Create: `fe/src/features/seller-reviews/model/review-inbox-view.ts`
- Create: `fe/src/features/seller-reviews/components/review-inbox.tsx`
- Create: `fe/src/features/seller-reviews/api/query-options.ts`
- Create: `fe/src/features/seller-reviews/index.ts`
- Modify: `fe/src/app/pages/seller/SellerReviews.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/seller-orders/components/order-queue.test.tsx`
- Test: `fe/src/features/seller-reviews/components/review-inbox.test.tsx`

**Interfaces:**
- Consumes: pending-order search, accept, reject without a body, ship with
  carrier/tracking, and review search/page APIs.
- Produces: capability-aware pending fulfillment queue, URL-selected order drawer, and paginated review inbox.

- [ ] **Step 1: Write failing capability and action tests**

`order-queue-view.test.ts`:

```ts
it("exposes valid actions for each pending sub-order state", () => {
  expect(toSellerOrderRow({ ...order, status: "PENDING_ACCEPTANCE" }).actions).toEqual([
    "accept",
    "reject",
  ]);
  expect(toSellerOrderRow({ ...order, status: "ACCEPTED" }).actions).toEqual(["ship"]);
  expect(toSellerOrderRow({ ...order, status: "SHIPPED" }).actions).toEqual([]);
});
```

`review-inbox.test.tsx`:

```tsx
it("renders supported search and pagination without a rating filter", () => {
  render(<ReviewInbox view={view} routeState={state} onRouteChange={vi.fn()} />);
  expect(screen.getByRole("searchbox")).toBeVisible();
  expect(screen.getByRole("navigation", { name: /pagination/i })).toBeVisible();
  expect(screen.queryByRole("combobox", { name: /rating/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /reply/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the pending fulfillment queue**

Define:

```ts
type SellerOrderAction = "accept" | "reject" | "ship";

export interface SellerOrderRow {
  id: string;
  orderId: string;
  createdAt: string;
  status: FulfillmentStatus;
  itemCount: number;
  itemSummary: string;
  actions: readonly SellerOrderAction[];
}
```

Export `FulfillmentStatus` from the canonical order contract as
`(typeof FULFILLMENT_STATUS_VALUES)[number]`, import it into the presenter, and
use an exhaustive `Record<FulfillmentStatus, readonly SellerOrderAction[]>`.
Do not default unknown text to a pending state; unknown wire values fail the
order schema.

The toolbar has search only because the endpoint accepts `q` but not page, sort, or status. The route stores `q` and `selected`; do not render fake status tabs or pagination. Opening a row writes `selected=<sub-order-id>` and shows a detail drawer without removing the list.

Accept and reject act after confirmation. The current
`PUT /seller/orders/{id}/reject` controller accepts no body and the use case has
no reason field, so the dialog has no reason input and the endpoint wrapper
sends no body. Ship requires carrier and tracking number. Pending mutations
disable all actions for that row and preserve query position after invalidation.

- [ ] **Step 3: Implement the supported review inbox**

The review route owns `q`, `page`, and `selected`. Submit search to update `q` and reset page to 1; map UI page 1 to endpoint page 0. Render review author, product, rating, comment, media, and date. Do not render rating filtering or replies because the endpoint supports neither.

Use:

```ts
export const sellerReviewKeys = {
  all: ["seller", "reviews"] as const,
  list: (params: { q?: string; page: number; size: number }) =>
    [...sellerReviewKeys.all, "list", params] as const,
};
```

- [ ] **Step 4: Remove compatibility wrappers after route migration**

Change `SellerOrders.tsx`, `SellerReviews.tsx`, and `ShipDialog.tsx` to public feature exports while existing imports settle:

```ts
export { SellerOrderQueueRoute as SellerOrders } from "@/features/seller-orders";
export { SellerReviewInboxRoute as SellerReviews } from "@/features/seller-reviews";
export { ShipOrderDialog as ShipDialog } from "@/features/seller-orders";
```

Plan 07 deletes these wrappers.

- [ ] **Step 5: Verify seller work queues**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/seller-orders src/features/seller-reviews
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use Playwright to search and select an order, accept, reject after confirmation
without sending a body, ship with carrier/tracking, search reviews, paginate
reviews, refresh selected records, and use back/forward navigation. Assert no
rejection-reason textbox is rendered.

- [ ] **Step 6: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): standardize seller work queues"
```

### Task 4: Clarify Seller Wallet And Supported Settings

**Files:**
- Create: `fe/src/features/seller-finance/model/wallet-view.ts`
- Create: `fe/src/features/seller-finance/model/wallet-view.test.ts`
- Create: `fe/src/features/seller-finance/components/wallet-page.tsx`
- Create: `fe/src/features/seller-finance/components/payout-dialog.tsx`
- Create: `fe/src/features/seller-finance/components/payout-history.tsx`
- Create: `fe/src/features/seller-finance/index.ts`
- Modify: `fe/src/shared/contracts/api/seller-finance.ts`
- Modify: `fe/src/shared/contracts/domain-enums.ts`
- Modify: `fe/src/app/pages/seller/SellerWallet.tsx`
- Create: `fe/src/features/seller-settings/components/seller-profile-summary.tsx`
- Create: `fe/src/features/seller-settings/index.ts`
- Modify: `fe/src/app/pages/seller/SellerSettings.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/seller-finance/components/wallet-page.test.tsx`
- Test: `fe/src/features/seller-settings/components/seller-profile-summary.test.tsx`
- Test: `fe/src/app/pages/seller/SellerWallet.test.tsx`

**Interfaces:**
- Consumes: wallet, payout history, retry-stable payout request, and read-only seller profile.
- Produces: separated balance/history presentation, payout eligibility, URL-owned status filter, and honest read-only settings.

- [ ] **Step 1: Write failing wallet eligibility and idempotency tests**

`wallet-view.test.ts`:

```ts
it("separates available balance from active and settled payouts", () => {
  const view = toWalletView({
    wallet: { balance: 500_000, pending: 75_000 },
    payouts: [
      { id: "p-1", status: "REQUESTED", amount: 100_000 },
      { id: "p-2", status: "PAID", amount: 200_000 },
    ],
  });
  expect(view.availableVnd).toBe(500_000);
  expect(view.pendingBalanceVnd).toBe(75_000);
  expect(view.activePayoutVnd).toBe(100_000);
  expect(view.history.map((item) => item.status)).toEqual(["REQUESTED", "PAID"]);
});
```

Extend `SellerWallet.test.tsx` to make the first payout request reject and the second succeed:

```ts
expect(requestPayout).toHaveBeenNthCalledWith(1, body, expect.any(String));
expect(requestPayout).toHaveBeenNthCalledWith(2, body, firstKey);
```

- [ ] **Step 2: Implement wallet and payout presentation**

Define:

```ts
export interface WalletView {
  availableVnd: number | null;
  pendingBalanceVnd: number | null;
  activePayoutVnd: number;
  canRequestPayout: boolean;
  history: readonly {
    id: string;
    amountVnd: number;
    status: PayoutStatus;
    requestedAt: string;
  }[];
}
```

Decode `PayoutStatus` as the exact backend union `REQUESTED | APPROVED |
SUBMITTING | SUBMITTED | PAID | UNKNOWN | REJECTED | CANCELLED | REVERSED |
PENDING | COMPLETED | FAILED`; do not collapse legacy or processing states.
`pendingBalanceVnd` comes only from `wallet.pending`, while
`activePayoutVnd` is a separately labeled sum of payout rows in
`REQUESTED/APPROVED/SUBMITTING/SUBMITTED/UNKNOWN/PENDING`. Never derive the
wallet's pending settlement balance from withdrawal history.

Use an unframed balance band plus compact history. The filter is URL-owned `all|active|paid|failed` and operates on the full currently returned payout array. The payout dialog validates amount greater than zero and no greater than available balance.

Keep:

```ts
const key = idempotencyKeyRef.current ?? crypto.randomUUID();
idempotencyKeyRef.current = key;
return requestPayout(body, key);
```

Clear the key on success or when the user explicitly closes and resets the dialog. Do not clear it on network or server failure.

- [ ] **Step 3: Replace raw settings JSON with the seller-profile contract**

Use the inferred `sellerProfileSchema` output from Task 1 and render shop name,
approval, tier, vacation mode, bank name, and the masked destination's
bank/last4/verification state as a definition list. Add a link to `/profile`
for buyer-account fields that `updateProfile` supports. Do not render a Save
button, editable seller field, plaintext destination, or "coming soon"
control. This instruction replaces the obsolete buyer-profile example below;
do not use `userProfileSchema`, `profile.name`, or seller phone/avatar data.

```tsx
<PageHeader title={t("seller.settings.title")} />
<dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
  <ProfileField label={t("seller.settings.shopName")} value={profile.shopName} />
  <ProfileField label={t("seller.settings.tier")} value={profile.tier} />
  <ProfileField label={t("seller.settings.bank")} value={profile.bankName ?? t("common.notProvided")} />
  <ProfileField label={t("seller.settings.destination")} value={profile.destination?.last4 ?? t("common.notProvided")} />
</dl>
```

- [ ] **Step 4: Verify finance and settings**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/seller-finance src/features/seller-settings src/app/pages/seller/SellerWallet.test.tsx
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use Playwright to filter payout history, reject invalid amount, retry a failed request with the same key, complete a request, and inspect seller settings without unsupported controls.

- [ ] **Step 5: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): clarify seller finance and settings"
```

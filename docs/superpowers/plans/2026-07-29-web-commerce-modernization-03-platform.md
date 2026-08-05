# VNShop Commerce Platform Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish explicit persona layouts, typed URL and query ownership, web-only brand tokens, and canonical shared UI patterns for the buyer, seller, and admin refactors.

**Architecture:** React Router owns storefront, auth, seller, and admin layout composition instead of pathname checks. Shared routing codecs and query factories provide stable typed state, while `design-system/tokens.json` emits a web namespace without changing Dart. Canonical primitives and commerce patterns live under `fe/src/shared` and expose small typed interfaces.

**Tech Stack:** React Router 7, TanStack Query 5, Zod 4, Tailwind CSS 4, Lucide React, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve every current public URL and authorization rule.
- Preserve `next=<pathname+search>` through unauthenticated role guards.
- Accept `?__commercePreview=modernized` only in Vite development mode.
- Keep navigable filters, tabs, page, sort, and selected record in the URL.
- Use `fe/src/shared/ui` for canonical primitives and `fe/src/shared/commerce` for reusable marketplace presentation.
- New icons use Lucide when an icon exists.
- New cards use 8px radius or less; page bands are unframed.
- The web token namespace must not change generated Dart bytes.
- New shared components cover loading, empty, error, pending, disabled, and long-text behavior.
- Run the master plan Review Gate after every task.
- Do not stage or commit `fe/.ua/`.

---

### Task 1: Introduce Explicit Persona Layout Routes

**Files:**
- Create: `fe/src/app/layouts/StorefrontLayout.tsx`
- Create: `fe/src/app/layouts/AuthLayout.tsx`
- Create: `fe/src/app/layouts/SellerLayout.tsx`
- Create: `fe/src/app/layouts/AdminLayout.tsx`
- Create: `fe/src/app/layouts/StandaloneLayout.tsx`
- Create: `fe/src/app/layouts/index.ts`
- Create: `fe/src/app/commerce-route-inventory.ts`
- Modify: `fe/src/app/routes.ts`
- Modify: `fe/src/app/pages/Root.tsx`
- Modify: `fe/src/app/pages/seller/SellerPage.tsx`
- Modify: `fe/src/app/pages/admin/AdminPage.tsx`
- Create: `fe/src/features/seller/index.ts`
- Create: `fe/src/features/admin/index.ts`
- Modify: `fe/src/app/components/console-chrome.tsx`
- Modify: `fe/src/app/lib/auth/role-guard.tsx`
- Modify: `fe/src/app/lib/auth/role-guard.test.tsx`
- Modify: `fe/src/app/routes.test.ts`
- Create: `fe/src/app/layouts/layouts.test.tsx`

**Interfaces:**
- Consumes: current `Navbar`, `AnnouncementBar`, `CategoriesBar`, `Footer`, `ConsoleChrome`, and role guards.
- Produces: route-owned `StorefrontLayout`, `AuthLayout`, `SellerLayout`, `AdminLayout`, and stable nested seller/admin paths.

- [ ] **Step 1: Write failing route and guard tests**

Extend `fe/src/app/routes.test.ts`:

```ts
it("declares explicit seller and admin child routes", () => {
  const seller = router.routes.find((route) => route.path === "/seller");
  const admin = router.routes.find((route) => route.path === "/admin");

  expect(seller?.children?.map((route) => route.path ?? "index")).toEqual([
    "index",
    "products",
    "orders",
    "reviews",
    "wallet",
    "settings",
  ]);
  expect(admin?.children?.map((route) => route.path ?? "index")).toEqual([
    "index",
    "orders",
    "coupons",
    "sellers",
    "reviews",
    "video",
    "disputes",
    "payouts",
    "users",
    "health",
  ]);
});
```

Add to `role-guard.test.tsx`:

```tsx
it("preserves next for an unauthenticated role route", () => {
  renderRoute(
    "/seller/orders?page=2",
    <RequireRole role="SELLER">
      <div>Seller orders</div>
    </RequireRole>,
  );
  expect(screen.getByTestId("location")).toHaveTextContent(
    "/login?next=%2Fseller%2Forders%3Fpage%3D2",
  );
});
```

Update the test router helper to expose `location.pathname + location.search` in `data-testid="location"`.

- [ ] **Step 2: Run focused tests and confirm current routing fails**

Run from `fe`:

```powershell
pnpm exec vitest run src/app/routes.test.ts src/app/lib/auth/role-guard.test.tsx
```

Expected: FAIL because seller/admin are wildcard route components and `RequireRole` redirects to `/login` without `next`.

- [ ] **Step 3: Create route-owned layout components**

`StorefrontLayout.tsx`:

```tsx
import { Outlet } from "react-router";

import { AnnouncementBar, CategoriesBar, Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";

export function StorefrontLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnnouncementBar />
      <Navbar />
      <CategoriesBar />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
```

`AuthLayout.tsx`:

```tsx
import { Outlet } from "react-router";

export function AuthLayout() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <Outlet />
    </main>
  );
}
```

`SellerLayout.tsx` and `AdminLayout.tsx` each render `ConsoleChrome`, a persona navigation region, `<Outlet />`, and a compact footer. Their navigation uses `<NavLink>` rather than click-driven local state:

```tsx
<NavLink
  to="/seller/orders"
  className={({ isActive }) => cn("console-nav-item", isActive && "console-nav-item-active")}
>
  <ShoppingBag aria-hidden="true" />
  <span>{t("seller.nav.orders")}</span>
</NavLink>
```

`StandaloneLayout.tsx` renders only `<Outlet />` for provider return pages that must keep their current behavior.

- [ ] **Step 4: Rebuild routes as explicit nested layouts**

In `routes.ts`, replace pathname-driven root composition with:

```ts
export const router = createBrowserRouter([
  {
    Component: StorefrontLayout,
    errorElement: createElement(RouteErrorPage),
    children: storefrontRoutes,
  },
  {
    Component: AuthLayout,
    children: [
      { path: "/login", element: lazyRoute(createElement(LoginPage)) },
      { path: "/register", element: lazyRoute(createElement(RegisterPage)) },
      { path: "/password-reset", element: lazyRoute(createElement(PasswordResetPage)) },
      { path: "/access-denied", element: lazyRoute(createElement(AccessDeniedPage)) },
    ],
  },
  {
    path: "/seller",
    element: sellerOnly(createElement(SellerLayout)),
    children: [
      { index: true, element: lazyRoute(createElement(SellerDashboardRoute)) },
      { path: "products", element: lazyRoute(createElement(SellerProductsRoute)) },
      { path: "orders", element: lazyRoute(createElement(SellerOrdersRoute)) },
      { path: "reviews", element: lazyRoute(createElement(SellerReviewsRoute)) },
      { path: "wallet", element: lazyRoute(createElement(SellerWalletRoute)) },
      { path: "settings", element: lazyRoute(createElement(SellerSettingsRoute)) },
    ],
  },
  {
    path: "/admin",
    element: adminOnly(createElement(AdminLayout)),
    children: [
      { index: true, element: lazyRoute(createElement(AdminDashboardRoute)) },
      { path: "orders", element: lazyRoute(createElement(AdminOrdersRoute)) },
      { path: "coupons", element: lazyRoute(createElement(AdminCouponsRoute)) },
      { path: "sellers", element: lazyRoute(createElement(AdminSellersRoute)) },
      { path: "reviews", element: lazyRoute(createElement(AdminReviewsRoute)) },
      { path: "video", element: lazyRoute(createElement(AdminVideoRoute)) },
      { path: "disputes", element: lazyRoute(createElement(AdminDisputesRoute)) },
      { path: "payouts", element: lazyRoute(createElement(AdminPayoutsRoute)) },
      { path: "users", element: lazyRoute(createElement(AdminUsersRoute)) },
      { path: "health", element: lazyRoute(createElement(AdminHealthRoute)) },
    ],
  },
  {
    Component: StandaloneLayout,
    children: [
      { path: "/payment/return/:provider", element: lazyRoute(createElement(PaymentReturnPage)) },
    ],
  },
]);
```

Export thin route components from seller/admin `index.ts`. Move each page's existing query ownership with its route; do not duplicate the badge and page queries in the layout.

Also create a browser-independent, non-runtime-mutable acceptance inventory in
`commerce-route-inventory.ts`:

```ts
export const MODERNIZED_COMMERCE_ROUTE_PATHS = [
  "/",
  "/search?q=phone",
  "/product/{seededProductId}",
  "/sellers/{acceptanceSellerId}",
  "/cart",
  "/checkout",
  "/payment/return/vnpay",
  "/orders",
  "/orders/{acceptanceOrderId}",
  "/returns",
  "/returns/new?orderId={acceptanceOrderId}",
  "/profile",
  "/wishlist",
  "/messages",
  "/notifications",
  "/notifications/preferences",
  "/seller",
  "/seller/products",
  "/seller/orders",
  "/seller/reviews",
  "/seller/wallet",
  "/seller/settings",
  "/admin",
  "/admin/sellers",
  "/admin/reviews",
  "/admin/video",
  "/admin/coupons",
  "/admin/disputes",
  "/admin/payouts",
  "/admin/users",
  "/admin/orders",
  "/admin/health",
] as const;
```

This is test metadata for the real route table, not a second router.
`routes.test.ts` imports it and proves each normalized path maps to the matching
real route pattern after removing query strings and translating acceptance
placeholders to `:id`; the canonical
`/payment/return/vnpay` representative maps to
`/payment/return/:provider`. Update the inventory in the same commit when a
modernized commerce route changes.

- [ ] **Step 5: Preserve role redirect destinations**

In `RequireRole`, add `const location = useLocation()` and use:

```tsx
if (!authenticated) {
  const next = encodeURIComponent(location.pathname + location.search);
  return (
    <RedirectWithToast
      to={`/login?next=${next}`}
      replace
      message={t("auth.loginRequired", { defaultValue: "Please sign in to continue" })}
    />
  );
}
```

Keep `/access-denied` for authenticated users lacking the admin role and the existing seller fallback behavior unless a route test proves a different current contract.

- [ ] **Step 6: Verify route behavior**

Run from `fe`:

```powershell
pnpm exec vitest run src/app/routes.test.ts src/app/lib/auth/role-guard.test.tsx src/app/layouts/layouts.test.tsx
pnpm run typecheck
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Expected: all public paths remain reachable; seller/admin children are explicit; unauthenticated role routes retain `next`.

- [ ] **Step 7: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "refactor(fe): compose persona layouts through routes"
```

### Task 2: Centralize URL State, Query Keys, And Development Preview

**Files:**
- Create: `fe/src/shared/routing/route-state.ts`
- Create: `fe/src/shared/routing/route-state.test.ts`
- Create: `fe/src/shared/routing/commerce-preview.ts`
- Create: `fe/src/shared/routing/commerce-preview.test.ts`
- Delete: `fe/src/app/routing/route-state.ts`
- Delete: `fe/src/app/routing/route-state.test.ts`
- Modify: `fe/src/features/catalog/search-route-state.ts`
- Create: `fe/src/features/seller/model/seller-route-state.ts`
- Create: `fe/src/features/admin/model/admin-route-state.ts`
- Create: `fe/src/features/seller/api/query-options.ts`
- Create: `fe/src/features/admin/api/query-options.ts`
- Test: `fe/src/features/seller/model/seller-route-state.test.ts`
- Test: `fe/src/features/admin/model/admin-route-state.test.ts`

**Interfaces:**
- Consumes: existing `RouteParamCodec`, `readRouteState`, `writeRouteState`, and existing endpoint parameter types.
- Produces: shared route codecs, `readCommercePreview`, seller/admin URL schemas, and parameterized query factories.

- [ ] **Step 1: Move route codecs with behavior-preserving tests**

Move `fe/src/app/routing/route-state.ts` and its tests to `fe/src/shared/routing/`. Update catalog imports to:

```ts
import {
  readRouteState,
  routeParam,
  writeRouteState,
  type RouteState,
} from "@/shared/routing/route-state";
```

Run:

```powershell
pnpm exec vitest run src/shared/routing/route-state.test.ts src/features/catalog/search-route-state.test.ts
```

Expected: PASS with no behavior changes.

- [ ] **Step 2: Write failing preview and console route-state tests**

Create `commerce-preview.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { readCommercePreview } from "./commerce-preview";

describe("readCommercePreview", () => {
  it("accepts the modernized preview only in development", () => {
    expect(readCommercePreview("?__commercePreview=modernized", true)).toBe("modernized");
    expect(readCommercePreview("?__commercePreview=modernized", false)).toBe("current");
    expect(readCommercePreview("?__commercePreview=other", true)).toBe("current");
  });
});
```

Create seller/admin state tests that prove normalization and URL persistence without adding unsupported endpoint parameters:

```ts
expect(readSellerOrdersRouteState("?q=phone&selected=sub-1")).toEqual({
  q: "phone",
  selected: "sub-1",
});

expect(readAdminOrdersRouteState("?page=-4&status=SHIPPED&selected=order-1")).toEqual({
  page: 1,
  q: "",
  status: "SHIPPED",
  selected: "order-1",
});
```

- [ ] **Step 3: Implement the development-only preview reader**

Create `commerce-preview.ts`:

```ts
export type CommercePreview = "current" | "modernized";

export function readCommercePreview(
  source: string | URLSearchParams,
  isDevelopment: boolean,
): CommercePreview {
  if (!isDevelopment) return "current";
  const params = typeof source === "string" ? new URLSearchParams(source) : source;
  return params.get("__commercePreview") === "modernized" ? "modernized" : "current";
}
```

Layouts may use:

```ts
const preview = readCommercePreview(location.search, import.meta.env.DEV);
```

Never include this parameter in production links, analytics, or canonical URLs. Plan 07 deletes this module and every branch that consumes it.

- [ ] **Step 4: Implement typed seller and admin URL schemas**

`seller-route-state.ts`:

```ts
import { readRouteState, routeParam, writeRouteState } from "@/shared/routing/route-state";

const schema = {
  q: routeParam.string({ defaultValue: "", maxLength: 100 }),
  selected: routeParam.string({ defaultValue: "", maxLength: 100 }),
};

export const readSellerOrdersRouteState = (source: string | URLSearchParams) =>
  readRouteState(source, schema);

export const writeSellerOrdersRouteState = (
  source: string | URLSearchParams,
  updates: Partial<ReturnType<typeof readSellerOrdersRouteState>>,
) => writeRouteState(source, schema, updates);
```

`admin-route-state.ts` defines an orders schema that matches `adminListOrders`:

```ts
const schema = {
  page: routeParam.integer({ defaultValue: 1, min: 1 }),
  q: routeParam.string({ defaultValue: "", maxLength: 100 }),
  status: routeParam.enum(
    ["all", "PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const,
    "all",
  ),
  selected: routeParam.string({ defaultValue: "", maxLength: 100 }),
};
```

Seller reviews and products define separate route schemas with their supported `page` inputs. Each admin queue owns its supported fields; queues without server pagination or status inputs omit those fields instead of sharing this order schema.

- [ ] **Step 5: Add query-key factories where parameters are shared or invalidated**

Create `seller/api/query-options.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";

import { sellerPendingOrders } from "@/app/lib/api/endpoints/orders";

export const sellerKeys = {
  all: ["seller"] as const,
  orders: () => [...sellerKeys.all, "orders"] as const,
  orderList: (params: { q?: string }) => [...sellerKeys.orders(), "list", params] as const,
};

export const sellerOrdersOptions = (params: { q?: string }) =>
  queryOptions({
    queryKey: sellerKeys.orderList(params),
    queryFn: () => sellerPendingOrders(params),
    staleTime: 30_000,
  });
```

Create the matching admin factory for lists that are invalidated after decisions. Do not wrap one-off unparameterized reads that have no shared invalidation.

- [ ] **Step 6: Verify URL and query ownership**

Run from `fe`:

```powershell
pnpm exec vitest run src/shared/routing src/features/catalog/search-route-state.test.ts src/features/seller/model/seller-route-state.test.ts src/features/admin/model/admin-route-state.test.ts
pnpm run typecheck
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Expected: PASS; URL state normalizes malformed input and query keys include every endpoint parameter.

- [ ] **Step 7: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "refactor(fe): centralize route and query state"
```

### Task 3: Move Transport And Contracts Into Shared Ownership

**Files:**
- Move contents: `fe/src/app/lib/api` to the existing `fe/src/shared/api` directory, except the catalog-owned files listed separately below (including colocated tests and `endpoints`)
- Move directory: `fe/src/app/types/api` to `fe/src/shared/contracts/api` (including colocated tests)
- Move: `fe/src/app/lib/domain-enums.ts` to `fe/src/shared/contracts/domain-enums.ts`
- Move: `fe/src/app/lib/domain-constants.ts` to `fe/src/shared/contracts/domain-constants.ts`
- Move: `fe/src/app/lib/runtime-endpoints.ts` to `fe/src/shared/config/runtime-endpoints.ts`
- Move: `fe/src/app/lib/auth/native-auth.ts` to `fe/src/shared/auth/native-auth.ts`
- Move: `fe/src/app/lib/auth/native-auth.test.ts` to `fe/src/shared/auth/native-auth.test.ts`
- Move: `fe/src/app/lib/address-key.ts` to `fe/src/shared/lib/address-key.ts`
- Move: `fe/src/app/lib/format.ts` to `fe/src/shared/lib/format.ts`
- Move: `fe/src/app/components/image-with-fallback.tsx` to `fe/src/shared/ui/image-with-fallback.tsx`
- Move: `fe/src/app/components/image-with-fallback.test.tsx` to `fe/src/shared/ui/image-with-fallback.test.tsx`
- Move: `fe/src/app/lib/api/product-mapper.ts` to `fe/src/features/catalog/model/product-mapper.ts`
- Move: `fe/src/app/lib/api/product-mapper.test.ts` to `fe/src/features/catalog/model/product-mapper.test.ts`
- Move: `fe/src/app/lib/api/catalog-flags.ts` to `fe/src/features/catalog/config/catalog-flags.ts`
- Move: `fe/src/app/hooks/use-product-reviews.ts` to `fe/src/features/reviews/api/use-product-reviews.ts`
- Move: `fe/src/app/lib/review-summary.ts` to `fe/src/features/reviews/model/review-summary.ts`
- Move: `fe/src/app/lib/review-summary.test.ts` to `fe/src/features/reviews/model/review-summary.test.ts`
- Move: `fe/src/app/test-utils/render-with-query-client.tsx` to `fe/src/shared/test/render-with-query-client.tsx`
- Create: `fe/src/features/catalog/model/product.ts`
- Create: `fe/src/features/catalog/model/category-label.ts`
- Create: `fe/src/features/catalog/index.ts`
- Create: `fe/src/features/reviews/index.ts`
- Modify: `fe/src/app/types/ui.ts`
- Modify: `fe/src/app/hooks/use-categories.ts`
- Modify: `fe/src/features/reviews/components/product-reviews-section.tsx`
- Create: `fe/src/shared/contracts/index.ts`
- Create: `fe/src/shared/auth/index.ts`
- Create: `fe/src/shared/config/index.ts`
- Create: `fe/src/shared/ui/index.ts`
- Create: `fe/scripts/check-boundaries.mjs`
- Create: `fe/scripts/check-boundaries.test.mjs`
- Create: `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-shared-importers.txt`
- Modify: the exact tracked importer set emitted by Step 3 under `fe/src`
- Modify: `fe/eslint.config.js`
- Modify: `fe/package.json`

**Interfaces:**
- Consumes: validated API client, endpoint modules, Zod schemas, domain enums, constants, and runtime URL helpers hardened in Plan 02.
- Produces: `@/shared/api`, `@/shared/contracts`, `@/shared/config`, and `pnpm run lint:boundaries`.

- [ ] **Step 1: Write failing dependency-boundary tests**

Create `fe/scripts/check-boundaries.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { importSpecifiers, inspectImport } from "./check-boundaries.mjs";

test("shared cannot import app or features", () => {
  assert.equal(
    inspectImport("src/shared/ui/button.tsx", "@/app/hooks/use-auth"),
    "shared must not import app or features",
  );
});

test("features cannot import app or another feature private file", () => {
  assert.equal(
    inspectImport("src/features/cart/model/cart-view.ts", "@/app/types/api"),
    "features must consume shared modules instead of app internals",
  );
  assert.equal(
    inspectImport(
      "src/features/cart/components/cart.tsx",
      "@/features/catalog/components/search-filters",
    ),
    "cross-feature imports must use the feature public index",
  );
  assert.equal(inspectImport("src/features/cart/components/cart.tsx", "@/features/catalog"), null);
  assert.equal(
    inspectImport(
      "src/features/reviews/components/reviews.tsx",
      "../../videos/components/VideoPlayer",
    ),
    "cross-feature imports must use the feature public index",
  );
  assert.equal(
    inspectImport("src/features/reviews/components/reviews.tsx", "../../videos"),
    null,
  );
  assert.equal(
    inspectImport(
      "src/features/cart/components/cart.tsx",
      "@/features/cart/../catalog/components/private",
    ),
    "cross-feature imports must use the feature public index",
  );
});

test("app composition imports features only through public indexes", () => {
  assert.equal(inspectImport("src/app/routes.ts", "@/features/catalog"), null);
  assert.equal(
    inspectImport("src/app/routes.ts", "@/features/catalog/components/private"),
    "app must import features through their public index",
  );
  assert.equal(
    inspectImport("src/app/layouts/storefront-layout.tsx", "../../features/cart/model/private"),
    "app must import features through their public index",
  );
});

test("finds static, side-effect, and dynamic imports", () => {
  assert.deepEqual(
    importSpecifiers(`
      import "@/shared/config";
      import { Button } from "@/shared/ui";
      const route = import("@/features/catalog");
    `),
    ["@/shared/config", "@/shared/ui", "@/features/catalog"],
  );
});
```

- [ ] **Step 2: Run the test and confirm the checker is missing**

Run: `node --test fe/scripts/check-boundaries.test.mjs`

Expected: FAIL because `check-boundaries.mjs` does not exist.

- [ ] **Step 3: Move schemas, domain values, runtime config, and API modules**

Before editing, capture the exact importer inventory:

```powershell
git grep -l -E 'app/(lib/api|types/api|types/ui|hooks/use-categories|hooks/use-product-reviews|lib/review-summary|test-utils/render-with-query-client|lib/auth/native-auth|lib/address-key|lib/format|components/image-with-fallback|lib/domain-enums|lib/domain-constants|lib/runtime-endpoints)|\.\./.*(lib/api|types/api|types/ui|use-categories|use-product-reviews|review-summary|render-with-query-client|native-auth|address-key|lib/format|image-with-fallback|domain-enums|domain-constants|runtime-endpoints)' -- 'fe/src/**/*.ts' 'fe/src/**/*.tsx' |
  Sort-Object |
  Set-Content docs/superpowers/reviews/2026-07-29-web-commerce-modernization-shared-importers.txt
```

Treat that generated file as the exhaustive modify list for this mechanical move and include it in the task commit. If a later verification search finds another importer, append its exact path before changing it.

Move the transport and contract modules, merging them with the Plan 02 `read-json` helper already in `shared/api`. Carve out the files that are not transport:

```text
src/shared/api/client.ts
src/shared/api/envelope.ts
src/shared/api/interceptors.ts
src/shared/api/endpoints/*
src/shared/contracts/api/*
src/shared/contracts/domain-enums.ts
src/shared/contracts/domain-constants.ts
src/shared/auth/native-auth.ts
src/shared/lib/address-key.ts
src/shared/lib/format.ts
src/shared/ui/image-with-fallback.tsx
src/shared/config/runtime-endpoints.ts
src/features/catalog/model/product.ts
src/features/catalog/model/product-mapper.ts
src/features/catalog/model/category-label.ts
src/features/catalog/config/catalog-flags.ts
src/features/reviews/api/use-product-reviews.ts
src/features/reviews/model/review-summary.ts
src/shared/test/render-with-query-client.tsx
```

Move only the `Product` interface from `app/types/ui.ts` into
`features/catalog/model/product.ts`; keep `UIOrder` in place until Plan 04
replaces it with the orders feature view model. Export `Product`, `fromServer`,
`catalogV2Enabled`, and `categoryDisplayLabel` from
`features/catalog/index.ts`. Remove `categoryDisplayLabel` from
`app/hooks/use-categories.ts` and update its app consumers to the catalog
public index.

Move the product-review query hook and review summary into the existing reviews
feature, export its public controller/component/query/view-model API from
`features/reviews/index.ts`, and update the product page to consume that index.
Change the reviews feature's video display import to the existing
`features/videos/index.ts` public API. Move the query test wrapper to
`shared/test` and update all test imports. This keeps API
transport independent from catalog presentation and gives temporary app
consumers a public feature import.

Create `shared/contracts/index.ts`:

```ts
export * from "./api";
export * from "./domain-constants";
export * from "./domain-enums";
```

Update the moved `shared/api/index.ts` to export `readJson` and `readJsonText`
alongside the existing client/envelope surface; do not expose endpoint-private
schemas through the root barrel.

Export `formatDate`, `formatPrice`, and `ImageWithFallback` from their
respective shared public indexes. Update every generated importer before
deleting the app-owned originals; shared commerce in Task 6 consumes only these
shared exports.

Create `shared/config/index.ts`:

```ts
export * from "./runtime-endpoints";
```

Create `shared/auth/index.ts` as the public export for the native token-session
functions used by app auth hooks and shared API interceptors. Update
`interceptors.ts` to import from `@/shared/auth/native-auth`, `users.ts` to
import `findAddressIndexByKey` from `@/shared/lib/address-key`, and
`native-auth.ts` to import `apiUrl` from `@/shared/config`.

Update all source imports mechanically:

```ts
import { ApiError } from "@/shared/api";
import { sellerPendingOrders } from "@/shared/api/endpoints/orders";
import type { CartItem, Order } from "@/shared/contracts";
import { PAYMENT_METHODS, type PaymentMethod } from "@/shared/contracts";
import { apiUrl } from "@/shared/config";
```

Use `rg -n 'app/(lib/api|types/api|lib/domain-|lib/runtime-endpoints)|\.\./.*(lib/api|types/api|domain-enums|domain-constants|runtime-endpoints)' fe/src` and update every result. Delete the old modules after no import references remain; do not keep transport compatibility wrappers.

- [ ] **Step 4: Implement the boundary checker**

Create `fe/scripts/check-boundaries.mjs`:

```js
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(feDir, "src");

export function inspectImport(file, specifier) {
  const candidate = specifier.startsWith("@/")
    ? `src/${specifier.slice(2)}`
    : specifier.startsWith(".")
      ? path.posix.join(path.posix.dirname(file), specifier)
      : specifier;
  const resolved = path.posix.normalize(candidate);

  if (file.startsWith("src/shared/") && /^src\/(app|features)(?:\/|$)/.test(resolved)) {
    return "shared must not import app or features";
  }
  if (file.startsWith("src/features/") && /^src\/app(?:\/|$)/.test(resolved)) {
    return "features must consume shared modules instead of app internals";
  }
  const owner = /^src\/features\/([^/]+)\//.exec(file)?.[1];
  const target = /^src\/features\/([^/]+)(\/.*)?$/.exec(resolved);
  if (file.startsWith("src/app/") && target?.[2]) {
    return "app must import features through their public index";
  }
  if (owner && target && target[1] !== owner && target[2]) {
    return "cross-feature imports must use the feature public index";
  }
  return null;
}

export function importSpecifiers(source) {
  const pattern = /(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g;
  return [...source.matchAll(pattern)].map((match) => match[1]).filter(Boolean);
}

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const target = path.join(directory, name);
    if (statSync(target).isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(name) ? [target] : [];
  });
}

const findings = [];
for (const absoluteFile of sourceFiles(sourceDir)) {
  const file = path.relative(feDir, absoluteFile).replaceAll("\\", "/");
  const source = readFileSync(absoluteFile, "utf8");
  for (const specifier of importSpecifiers(source)) {
    const message = inspectImport(file, specifier);
    if (message) findings.push(`${file}: ${message}: ${specifier}`);
  }
}
if (findings.length > 0) {
  findings.forEach((finding) => console.error(finding));
  process.exitCode = 1;
}
```

Add:

```json
{
  "scripts": {
    "lint:boundaries": "node scripts/check-boundaries.mjs",
    "lint:all": "pnpm run lint && pnpm run lint:i18n && pnpm run lint:tokens && pnpm run lint:type-safety && pnpm run lint:boundaries"
  }
}
```

- [ ] **Step 5: Add ESLint zones as a second boundary gate**

In `eslint.config.js`, add:

```js
"import/no-restricted-paths": [
  "error",
  {
    zones: [
      { target: "./src/shared", from: "./src/app" },
      { target: "./src/shared", from: "./src/features" },
      { target: "./src/features", from: "./src/app" },
    ],
  },
],
"no-restricted-imports": [
  "error",
  {
    "patterns": [
      {
        "group": ["@/features/*/*"],
        "message": "App composition must import a feature's public index."
      }
    ]
  }
],
```

Apply `no-restricted-imports` only to `src/app/**/*.{ts,tsx}`. The script
handles both alias and normalized relative app-to-private-feature imports plus
public cross-feature imports; ESLint provides a second gate for alias imports
and relative imports that cross app/shared/feature ownership.

- [ ] **Step 6: Verify moves and boundaries**

Run from `fe`:

```powershell
node --test scripts/check-boundaries.test.mjs
pnpm run lint:boundaries
pnpm run typecheck
pnpm run lint:all
pnpm run test
pnpm run build
```

Expected: all commands pass and `Test-Path src/app/lib/api`, `Test-Path src/app/types/api`, `Test-Path src/app/lib/auth/native-auth.ts`, `Test-Path src/app/lib/address-key.ts`, and `Test-Path src/app/lib/domain-enums.ts` are all false.

- [ ] **Step 7: Review and commit**

Use the master Review Gate, then commit:

```powershell
$sourcePaths = @(
  git diff --name-only --diff-filter=ACMR $env:LINT_BASE_SHA -- fe/src
  git ls-files --others --exclude-standard -- fe/src
) | Sort-Object -Unique
# Compare this exact list with the importer evidence, explicit move
# destinations, and Files inventory above. Abort on any undeclared path.
$sourcePaths | ForEach-Object { git add -- $_ }
git add -- fe/scripts/check-boundaries.mjs fe/scripts/check-boundaries.test.mjs fe/eslint.config.js fe/package.json
git add -f docs/superpowers/reviews/2026-07-29-web-commerce-modernization-shared-importers.txt
$deletedPaths = git diff --name-only --diff-filter=D $env:LINT_BASE_SHA -- fe/src
# Require exact set equality with the Move/Delete sources above, then stage
# each path individually; never stage app/shared/features as directories.
$deletedPaths | ForEach-Object { git add -- $_ }
git diff --cached --check
git diff --cached --name-status
git commit -m "refactor(fe): move transport and contracts to shared"
```

### Task 4: Add A Web-Only Clean Marketplace Token Namespace

**Files:**
- Modify: `design-system/tokens.json`
- Modify: `scripts/generate-design-tokens.mjs`
- Modify: `scripts/generate-design-tokens.test.mjs`
- Modify: `fe/src/styles/generated-tokens.css`
- Modify: `fe/src/styles/theme.css`
- Test: `scripts/generate-design-tokens.test.mjs`
- Verify unchanged: `vnshop_mobile/lib/core/design_system/generated/design_tokens.dart`

**Interfaces:**
- Consumes: shared `color`, `size`, `type`, and `shadow` token structures.
- Produces: `tokens.web.light`, `tokens.web.dark`, CSS variables prefixed `--web-`, and byte-stable Dart output.

- [ ] **Step 1: Write failing web-token and Dart-stability tests**

Add to `scripts/generate-design-tokens.test.mjs`:

```js
test("web brand tokens emit CSS without changing Dart", async () => {
  const tokens = await loadTokens(tokenPath);
  const sharedOnly = structuredClone(tokens);
  delete sharedOnly.web;

  assert.match(renderCss(tokens), /--web-brand: #d63c2f;/);
  assert.match(renderCss(tokens), /--web-graphite: #24262b;/);
  assert.match(renderCss(tokens), /--web-cobalt: #2457c5;/);
  assert.equal(renderDart(tokens), renderDart(sharedOnly));
  assert.ok(contrastRatio(tokens.web.light.onBrand, tokens.web.light.brand) >= 4.5);
  assert.ok(contrastRatio(tokens.web.dark.onBrand, tokens.web.dark.brand) >= 4.5);
});
```

Export `contrastRatio` if it is not already exported.

- [ ] **Step 2: Run the generator test and confirm web tokens are absent**

Run: `node --test scripts/generate-design-tokens.test.mjs`

Expected: FAIL because `tokens.web` and `--web-*` variables do not exist.

- [ ] **Step 3: Add exact web brand values**

Add to `design-system/tokens.json`:

```json
{
  "web": {
    "light": {
      "brand": "#d63c2f",
      "brandHover": "#be3027",
      "onBrand": "#ffffff",
      "brandSubtle": "#fff0ed",
      "graphite": "#24262b",
      "onGraphite": "#ffffff",
      "cobalt": "#2457c5",
      "campaignAccent": "#f2ad00",
      "onCampaignAccent": "#251a00"
    },
    "dark": {
      "brand": "#ff8b7b",
      "brandHover": "#ffa296",
      "onBrand": "#2a0905",
      "brandSubtle": "#4a1f1a",
      "graphite": "#eef0f4",
      "onGraphite": "#17191f",
      "cobalt": "#8eafff",
      "campaignAccent": "#ffc247",
      "onCampaignAccent": "#2b1e00"
    }
  }
}
```

These values establish a warm vermilion storefront, graphite utility emphasis, cobalt information accents, and amber campaign urgency while leaving shared mobile colors untouched.

- [ ] **Step 4: Emit web CSS only**

Add:

```js
function cssWebVariables(theme) {
  return Object.entries(theme)
    .map(([name, value]) => `  --web-${kebabCase(name)}: ${value};`)
    .join("\n");
}
```

Append `cssWebVariables(tokens.web.light)` to `:root` and `cssWebVariables(tokens.web.dark)` to `.dark` in `renderCss`. Do not reference `tokens.web` from `renderDart`.

In `theme.css`, map semantic web aliases:

```css
:root {
  --primary: var(--web-brand);
  --primary-hover: var(--web-brand-hover);
  --primary-foreground: var(--web-on-brand);
  --accent: var(--web-campaign-accent);
  --accent-foreground: var(--web-on-campaign-accent);
  --commerce-info: var(--web-cobalt);
  --utility-strong: var(--web-graphite);
}
```

Keep danger mapped to shared danger tokens so a destructive action remains distinguishable from brand.

- [ ] **Step 5: Regenerate and prove mobile byte stability**

Before generation:

```powershell
$before = (Get-FileHash vnshop_mobile/lib/core/design_system/generated/design_tokens.dart -Algorithm SHA256).Hash
node scripts/generate-design-tokens.mjs
$after = (Get-FileHash vnshop_mobile/lib/core/design_system/generated/design_tokens.dart -Algorithm SHA256).Hash
if ($before -ne $after) { throw "Flutter token output changed" }
node --test scripts/generate-design-tokens.test.mjs
```

Expected: hashes match and tests pass.

- [ ] **Step 6: Review and commit**

Use the master Review Gate, then commit:

```powershell
git add design-system/tokens.json scripts/generate-design-tokens.mjs scripts/generate-design-tokens.test.mjs fe/src/styles/generated-tokens.css fe/src/styles/theme.css
git commit -m "feat(fe): add clean marketplace web tokens"
```

### Task 5: Complete Canonical Shared Primitives

**Files:**
- Create: `fe/src/shared/ui/checkbox.tsx`
- Create: `fe/src/shared/ui/switch.tsx`
- Create: `fe/src/shared/ui/segmented-control.tsx`
- Create: `fe/src/shared/ui/tooltip.tsx`
- Create: `fe/src/shared/ui/drawer.tsx`
- Create: `fe/src/shared/ui/data-table.tsx`
- Create: `fe/src/shared/ui/table-toolbar.tsx`
- Create: `fe/src/shared/ui/pagination.tsx`
- Create: `fe/src/shared/ui/inline-alert.tsx`
- Create: `fe/src/shared/ui/progress.tsx`
- Modify: `fe/src/shared/ui/index.ts`
- Modify: `fe/src/shared/ui/alert-dialog.tsx`
- Modify: `fe/src/shared/ui/async-state.tsx`
- Modify: `fe/src/shared/ui/async-state-model.ts`
- Modify: `fe/src/shared/ui/button.tsx`
- Modify: `fe/src/shared/ui/dialog.tsx`
- Modify: `fe/src/shared/ui/field.tsx`
- Modify: `fe/src/shared/ui/icon-button.tsx`
- Modify: `fe/src/shared/ui/page-container.tsx`
- Modify: `fe/src/shared/ui/page-header.tsx`
- Modify: `fe/src/shared/ui/skeleton.tsx`
- Modify: `fe/src/shared/ui/status-indicator.tsx`
- Modify: `fe/src/shared/ui/surface.tsx`
- Modify: `fe/src/shared/ui/tabs.tsx`
- Modify: `fe/src/app/components/ui/confirm-dialog.tsx`
- Modify: `fe/src/app/components/ui/empty-state.tsx`
- Modify: `fe/src/app/components/ui/live-region.tsx`
- Modify: `fe/src/app/components/ui/modal.tsx`
- Modify: `fe/src/app/components/ui/page-skeleton.tsx`
- Modify: `fe/src/app/pages/DesignSystemPage.tsx`
- Test: `fe/src/shared/ui/primitives.test.tsx`
- Test: `fe/src/shared/ui/data-table.test.tsx`
- Test: `fe/src/shared/ui/drawer.test.tsx`
- Test: `fe/src/shared/ui/accessibility.test.tsx`

**Interfaces:**
- Consumes: shared tokens, `cn`, Lucide icons, and existing `Button`, `Dialog`, `Field`, `Tabs`, and async-state primitives.
- Produces: one public shared UI barrel and typed operational controls.

- [ ] **Step 1: Write failing behavior and accessibility tests**

Add tests:

```tsx
it("renders pagination as navigation with disabled boundaries", async () => {
  const onPageChange = vi.fn();
  render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
  expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: /next/i }));
  expect(onPageChange).toHaveBeenCalledWith(2);
});

it("traps focus and returns it after closing a drawer", async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open order</button>
        <Drawer open={open} title="Order details" onOpenChange={setOpen}>
          <button>Action</button>
        </Drawer>
      </>
    );
  }
  render(<Harness />);
  const opener = screen.getByRole("button", { name: "Open order" });
  await user.click(opener);
  expect(screen.getByRole("dialog", { name: "Order details" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Action" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: /close/i })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Action" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "Order details" })).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

it("labels icon-only controls through tooltip content", () => {
  render(<Tooltip label="Filter products"><IconButton label="Filter products"><Filter /></IconButton></Tooltip>);
  expect(screen.getByRole("button", { name: "Filter products" })).toBeVisible();
});
```

- [ ] **Step 2: Define stable shared interfaces**

Use these public interfaces:

```ts
export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export interface DataTableColumn<TRow> {
  id: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
  priority?: "primary" | "secondary" | "tertiary";
  align?: "start" | "center" | "end";
}

export interface DataTableProps<TRow> {
  rows: readonly TRow[];
  columns: readonly DataTableColumn<TRow>[];
  rowKey: (row: TRow) => string;
  selectedId?: string;
  onRowOpen?: (row: TRow) => void;
  empty: ReactNode;
  caption: string;
}

export interface DrawerProps {
  open: boolean;
  title: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
}
```

`DataTable` hides tertiary columns below 1024px and secondary columns below 768px while keeping the primary cell and row action accessible.

Change `PageContainer` from a nested `<main>` to a layout container and add density:

```ts
export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  density?: "standard" | "compact";
}
```

Render a `<div>` with `py-6` for standard and `py-4` for compact. Persona layouts remain the single owners of the `main` landmark.

- [ ] **Step 3: Implement primitives using existing dialog and button behavior**

Build Drawer over the same focus-management and escape-key behavior as `shared/ui/dialog.tsx`. Use fixed dimensions:

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  className="fixed inset-y-0 right-0 z-50 grid w-full max-w-[min(100vw,36rem)] grid-rows-[auto_minmax(0,1fr)_auto] border-l border-border bg-card"
>
```

Build Pagination with Lucide `ChevronLeft` and `ChevronRight`, 44px controls, and text-hidden accessible labels. Build checkbox, switch, segmented control, tooltip, alerts, and progress with native semantics first; do not draw custom SVG.

Export all canonical components from `fe/src/shared/ui/index.ts`. Convert `fe/src/app/components/ui/modal.tsx`, `confirm-dialog.tsx`, `empty-state.tsx`, and `page-skeleton.tsx` to deprecation-commented re-exports with no implementation logic.

- [ ] **Step 4: Expand the design-system review route**

Render light and dark examples for:

- buttons and icon buttons in enabled, pending, and disabled states;
- fields, checkbox, switch, and segmented controls;
- tabs, pagination, toolbar, table, drawer, dialog, tooltip, and alerts;
- loading, empty, partial, error, and ready states;
- Vietnamese and English long labels;
- 200% text zoom;
- 390px and 1440px widths.

Use actual components in unframed sections. Do not describe keyboard shortcuts or implementation details in visible UI.

- [ ] **Step 5: Verify primitives**

Run from `fe`:

```powershell
pnpm exec vitest run src/shared/ui
pnpm run test:a11y
pnpm run typecheck
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Expected: unit tests pass and Axe reports no critical violations on the design-system route.

- [ ] **Step 6: Review and commit**

Use the master Review Gate with screenshots at 390x844 and 1440x900, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): complete canonical shared UI primitives"
```

### Task 6: Add Shared Commerce Presentation Patterns

**Files:**
- Create: `fe/src/shared/commerce/product-tile.tsx`
- Create: `fe/src/shared/commerce/product-grid.tsx`
- Create: `fe/src/shared/commerce/price.tsx`
- Create: `fe/src/shared/commerce/rating.tsx`
- Create: `fe/src/shared/commerce/seller-identity.tsx`
- Create: `fe/src/shared/commerce/trust-cues.tsx`
- Create: `fe/src/shared/commerce/campaign-media.tsx`
- Create: `fe/src/shared/commerce/horizontal-rail.tsx`
- Create: `fe/src/shared/commerce/index.ts`
- Modify: `fe/src/app/pages/DesignSystemPage.tsx`
- Test: `fe/src/shared/commerce/product-tile.test.tsx`
- Test: `fe/src/shared/commerce/commerce-patterns.test.tsx`

**Interfaces:**
- Consumes: shared UI primitives, semantic tokens, existing locale-aware money formatter, and image fallback.
- Produces: stable marketplace components that buyer pages reuse without importing feature internals.

- [ ] **Step 1: Write failing product-tile tests**

Create `product-tile.test.tsx`:

```tsx
it("renders trustworthy commerce data without resizing the tile", () => {
  render(
    <ProductTile
      product={{
        id: "product-1",
        name: "A very long Vietnamese product name that must wrap without moving actions",
        imageUrl: "",
        priceVnd: 1_250_000,
        originalPriceVnd: 1_500_000,
        rating: 4.8,
        soldCount: 2300,
        sellerName: "VNShop Mall",
        stockState: "in-stock",
      }}
      href="/product/product-1"
    />,
  );
  expect(screen.getByRole("link", { name: /very long vietnamese/i })).toHaveAttribute(
    "href",
    "/product/product-1",
  );
  expect(screen.getByText(/VNShop Mall/)).toBeVisible();
  expect(screen.getByText(/17%/)).toBeVisible();
});

it("marks unavailable products and omits unsupported actions", () => {
  render(<ProductTile product={{ ...product, stockState: "unavailable" }} href="/product/p-1" />);
  expect(screen.getByText(/unavailable/i)).toBeVisible();
  expect(screen.queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Define commerce view types**

```ts
export interface ProductTileView {
  id: string;
  name: string;
  imageUrl?: string;
  priceVnd: number;
  originalPriceVnd?: number;
  rating?: number;
  soldCount?: number;
  sellerName?: string;
  stockState: "in-stock" | "low-stock" | "unavailable";
}

export interface TrustCue {
  id: "buyer-protection" | "returns" | "shipping";
  label: string;
  detail?: string;
}
```

Feature presenters map domain responses into these types. Shared commerce components never inspect API envelopes.

- [ ] **Step 3: Implement stable product and pricing composition**

`ProductTile` uses:

```tsx
<article className="grid h-full grid-rows-[auto_minmax(3rem,auto)_auto_auto] overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
  <Link to={href} aria-label={product.name} className="aspect-square overflow-hidden bg-muted">
    <ImageWithFallback className="h-full w-full object-cover" src={product.imageUrl ?? ""} alt="" />
  </Link>
  <h3 className="line-clamp-2 px-3 pt-3 text-sm font-medium">{product.name}</h3>
  <Price priceVnd={product.priceVnd} originalPriceVnd={product.originalPriceVnd} />
  <div className="min-h-11 px-3 pb-3">
    <Rating value={product.rating} soldCount={product.soldCount} />
    {product.sellerName ? <SellerIdentity name={product.sellerName} /> : null}
  </div>
</article>
```

Calculate discount only when `originalPriceVnd > priceVnd`. Clamp rating to 0-5. Use `Intl.NumberFormat` through the existing shared formatter. Do not use viewport-based font sizes.

- [ ] **Step 4: Implement rails, campaign media, and trust cues**

`HorizontalRail` uses CSS scroll snapping and icon buttons:

```tsx
<section aria-labelledby={headingId}>
  <div className="flex items-center justify-between">
    <h2 id={headingId}>{title}</h2>
    <div className="hidden gap-1 md:flex">
      <IconButton label={previousLabel} onClick={() => scrollBy(-1)}><ChevronLeft /></IconButton>
      <IconButton label={nextLabel} onClick={() => scrollBy(1)}><ChevronRight /></IconButton>
    </div>
  </div>
  <div ref={railRef} className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-auto scroll-smooth snap-x">
    {children}
  </div>
</section>
```

`CampaignMedia` reserves an aspect ratio, renders real product/seller imagery, supports one primary link, and honors reduced motion. `TrustCues` maps known cue IDs to Lucide icons and never uses color alone.

- [ ] **Step 5: Verify long content and missing data**

Run from `fe`:

```powershell
pnpm exec vitest run src/shared/commerce
pnpm run typecheck
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Capture design-system screenshots at 390x844 and 1440x900 with a 120-character title, missing image, no rating, large price, and unavailable stock. Expected: no overlap, horizontal page overflow, or card-height shift within one grid row.

- [ ] **Step 6: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): add shared marketplace patterns"
```

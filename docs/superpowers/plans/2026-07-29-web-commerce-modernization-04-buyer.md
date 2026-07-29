# VNShop Buyer Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the complete buyer journey into a clean, high-density Vietnamese marketplace experience from discovery through checkout, orders, returns, and account communication.

**Architecture:** Thin route pages compose bounded buyer features whose controllers own queries and mutations and whose presenters map decoded domain data into shared commerce view types. The storefront remains search-led and product-forward, route state remains URL-owned, and all purchase actions preserve the hardened checkout and existing API semantics.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Zustand 5, React Hook Form 7, Zod 4, shared UI and commerce patterns from Plan 03, Vitest, Playwright.

## Global Constraints

- Preserve the familiar marketplace order: utility navigation, sticky search, campaign media, service shortcuts, categories, flash sale, featured sellers, video/live content when available, and recommendations.
- Use real catalog, seller, or review-video media already returned by APIs; do not use gradients, decorative blobs, or invented product imagery.
- Keep search, filters, sort, pagination, and selected product tabs refreshable and deep-linkable.
- Keep product-grid dimensions stable for long titles, missing images, discounts, and absent ratings.
- Group cart items by seller and show only server-supported vouchers, shipping, stock, and price states.
- Keep checkout order and payment behavior from Plan 02a unchanged.
- Prevent mobile sticky controls from covering content or browser/system navigation.
- Provide loading, empty, partial, error, pending, and success states for each critical route.
- Use localized strings and locale-aware VND, dates, and counts.
- Run the master plan Review Gate after every task.
- Do not stage or commit `fe/.ua/`.

---

### Task 1: Rebuild The Storefront Shell And Home Marketplace

**Files:**
- Modify: `fe/src/app/layouts/StorefrontLayout.tsx`
- Modify: `fe/src/app/components/navbar.tsx`
- Modify: `fe/src/app/components/footer.tsx`
- Create: `fe/src/features/storefront/model/home-view.ts`
- Create: `fe/src/features/storefront/model/home-view.test.ts`
- Create: `fe/src/features/storefront/components/marketplace-home.tsx`
- Create: `fe/src/features/storefront/components/campaign-band.tsx`
- Create: `fe/src/features/storefront/components/service-shortcuts.tsx`
- Create: `fe/src/features/storefront/components/category-rail.tsx`
- Create: `fe/src/features/storefront/components/flash-sale-shelf.tsx`
- Create: `fe/src/features/storefront/components/trusted-seller-rail.tsx`
- Create: `fe/src/features/storefront/components/storefront-mobile-nav.tsx`
- Create: `fe/src/features/storefront/index.ts`
- Modify: `fe/src/app/pages/HomePage.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/storefront/components/marketplace-home.test.tsx`
- Test: `fe/src/app/layouts/StorefrontLayout.test.tsx`

**Interfaces:**
- Consumes: existing category, flash-sale, product, seller-showcase, recommendation, recently-viewed, auth, wishlist, and cart hooks.
- Produces: `HomeMarketplaceView`, `toHomeMarketplaceView`, `MarketplaceHome`, and a search-first responsive storefront shell.

- [ ] **Step 1: Write failing presenter tests**

Create `home-view.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { toHomeMarketplaceView } from "./home-view";

describe("toHomeMarketplaceView", () => {
  it("uses real product media for the campaign and preserves section truth", () => {
    const view = toHomeMarketplaceView({
      categories: [{ id: "phones", name: "Phones" }],
      flashProducts: [
        {
          id: "p-1",
          name: "Phone Pro",
          image: "https://cdn.example/phone.jpg",
          price: 10_000_000,
          originalPrice: 12_000_000,
        },
      ],
      sellers: [{
        id: "s-1",
        shopName: "VNShop Mall",
        tier: "STANDARD",
        joinedAt: "2026-01-01T00:00:00Z",
        ratingAvg: 4.8,
        ratingCount: 120,
        totalProducts: 24,
      }],
      recommendations: [],
      recentlyViewed: [],
    });

    expect(view.campaign).toMatchObject({
      imageUrl: "https://cdn.example/phone.jpg",
      href: "/product/p-1",
    });
    expect(view.sections.recommendations).toBe("empty");
    expect(view.sections.flashSale).toBe("ready");
  });

  it("omits media sections when no supported data exists", () => {
    const view = toHomeMarketplaceView({
      categories: [],
      flashProducts: [],
      sellers: [],
      recommendations: [],
      recentlyViewed: [],
    });
    expect(view.campaign).toBeNull();
    expect(view.liveCommerce).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the presenter test and confirm the feature is missing**

Run: `pnpm exec vitest run src/features/storefront/model/home-view.test.ts`

Working directory: `fe`

Expected: FAIL because the storefront feature does not exist.

- [ ] **Step 3: Define and implement the home view model**

Create `home-view.ts` with explicit view data:

```ts
import type { ProductTileView } from "@/shared/commerce";

export interface HomeMarketplaceView {
  campaign: null | {
    title: string;
    imageUrl: string;
    href: string;
    priceVnd: number;
  };
  shortcuts: readonly {
    id: "vouchers" | "shipping" | "mall" | "video" | "delivery";
    labelKey: string;
    href: string;
  }[];
  categories: readonly { id: string; label: string; href: string }[];
  flashSale: readonly ProductTileView[];
  featuredSellers: readonly { id: string; name: string; rating?: number; href: string }[];
  liveCommerce: readonly { id: string; title: string; thumbnailUrl: string; href: string }[];
  recommendations: readonly ProductTileView[];
  recentlyViewed: readonly ProductTileView[];
  sections: Record<
    "categories" | "flashSale" | "featuredSellers" | "recommendations" | "recentlyViewed",
    "empty" | "ready"
  >;
}
```

`toHomeMarketplaceView` chooses the first flash product with a non-empty image
as campaign media, maps products through one `toProductTileView` presenter,
maps featured seller name/rating only from `publicSellerSchema`, and returns an
empty `liveCommerce` collection when no current endpoint supplies home video
entries. It does not infer seller verification from tier, rating, or name.

- [ ] **Step 4: Build the search-led storefront header**

Keep VNShop as a first-viewport signal. Structure the desktop header as:

```tsx
<header className="sticky top-0 z-40 border-b border-border bg-card">
  <AnnouncementBar />
  <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[auto_minmax(16rem,1fr)_auto] items-center gap-4 px-4">
    <Link to="/" className="text-xl font-extrabold text-[var(--web-brand)]">VNShop</Link>
    <StorefrontSearch />
    <StorefrontActions />
  </div>
  <CategoriesBar />
</header>
```

On mobile, keep a 56px brand/action row and a second sticky 48px search row. Move theme choice into the account menu. Remove the floating dark-mode button. `StorefrontMobileNav` contains Home, Search, Cart, and Account icon links with safe-area padding:

```tsx
className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(3.75rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
```

Add matching bottom padding to the storefront main region so content is never covered.

- [ ] **Step 5: Build the product-forward home composition**

`MarketplaceHome` renders unframed full-width bands in this order:

```tsx
<PageContainer>
  <CampaignBand campaign={view.campaign} secondaryProducts={view.flashSale.slice(1, 3)} />
  <ServiceShortcuts items={view.shortcuts} />
  <CategoryRail categories={view.categories} />
  <FlashSaleShelf products={view.flashSale} />
  <FeaturedSellerRail sellers={view.featuredSellers} />
  {view.liveCommerce.length > 0 ? <LiveCommerceRail items={view.liveCommerce} /> : null}
  <ProductGrid title={t("home.recommended")} products={view.recommendations} />
  {view.recentlyViewed.length > 0 ? (
    <ProductGrid title={t("home.recentlyViewed")} products={view.recentlyViewed} />
  ) : null}
</PageContainer>
```

`CampaignBand` uses the product image as an inspectable media surface, preserves its aspect ratio, and reveals the category rail within the first 844px viewport. It does not use a split text/card hero or decorative gradient.

- [ ] **Step 6: Make HomePage a thin composer**

`HomePage.tsx` reads existing hooks, returns explicit async states, and maps decoded data once:

```tsx
export function HomePage() {
  const queries = useHomeQueries();
  if (queries.requiredError) {
    return (
      <AsyncState
        status="error"
        loading={<MarketplaceHomeSkeleton />}
        error={<p>{t("home.error.title")}</p>}
        empty={<p>{t("home.empty.title")}</p>}
        retry={{ label: t("common.retry"), onClick: queries.retry }}
      >
        {null}
      </AsyncState>
    );
  }
  if (queries.initialLoading) return <MarketplaceHomeSkeleton />;
  return <MarketplaceHome view={toHomeMarketplaceView(queries.data)} />;
}
```

Allow recommendation and recently-viewed failures to render as partial state without hiding categories and flash sale.

- [ ] **Step 7: Verify storefront behavior**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/storefront src/app/layouts/StorefrontLayout.test.tsx
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Capture 390x844, 768x1024, 1024x768, and 1440x900 screenshots. Expected: VNShop and search are immediately visible, category content peeks into the first viewport, product media is real API data, and no sticky element overlaps content.

- [ ] **Step 8: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): modernize storefront discovery"
```

### Task 2: Refactor Search And Product Detail Into Focused Features

**Files:**
- Modify: `fe/src/features/catalog/search-route-state.ts`
- Create: `fe/src/features/catalog/model/search-view.ts`
- Create: `fe/src/features/catalog/model/search-view.test.ts`
- Create: `fe/src/features/catalog/components/search-results.tsx`
- Create: `fe/src/features/catalog/components/search-toolbar.tsx`
- Create: `fe/src/features/catalog/components/mobile-filter-drawer.tsx`
- Modify: `fe/src/features/catalog/components/search-filters.tsx`
- Modify: `fe/src/features/catalog/index.ts`
- Modify: `fe/src/app/pages/SearchPage.tsx`
- Create: `fe/src/features/product/model/product-view.ts`
- Create: `fe/src/features/product/model/product-view.test.ts`
- Create: `fe/src/features/product/api/use-product-seller.ts`
- Create: `fe/src/features/product/components/product-detail.tsx`
- Create: `fe/src/features/product/components/product-gallery.tsx`
- Create: `fe/src/features/product/components/product-purchase-panel.tsx`
- Create: `fe/src/features/product/components/product-trust-section.tsx`
- Create: `fe/src/features/product/components/mobile-purchase-bar.tsx`
- Create: `fe/src/features/product/index.ts`
- Modify: `fe/src/app/pages/ProductPage.tsx`
- Create: `fe/src/app/pages/ProductPage.test.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/catalog/components/search-results.test.tsx`
- Test: `fe/src/features/product/components/product-detail.test.tsx`

**Interfaces:**
- Consumes: existing search-v2/fallback hooks, facets, product detail, reviews, questions, videos, seller, wishlist, cart, and recommendation APIs.
- Produces: `SearchResultsView`, `ProductDetailView`, URL-owned product section, and focused search/product components.

- [ ] **Step 1: Write failing presenter tests for truthful result and product states**

`search-view.test.ts`:

```ts
it("distinguishes fallback results from an empty search", () => {
  expect(
    toSearchResultsView({
      query: "camera",
      source: "fallback",
      products: [product],
      total: 1,
      error: null,
    }),
  ).toMatchObject({ status: "partial", source: "fallback", resultCount: 1 });

  expect(
    toSearchResultsView({
      query: "camera",
      source: "primary",
      products: [],
      total: 0,
      error: null,
    }),
  ).toMatchObject({ status: "empty", source: "primary", resultCount: 0 });
});
```

`product-view.test.ts`:

```ts
it("exposes only valid purchase actions", () => {
  expect(
    toProductDetailView({ product: { ...product, stock: 0 }, selectedVariant: null }),
  ).toMatchObject({
    stockState: "unavailable",
    actions: { addToCart: false, buyNow: false },
  });
});

it("uses a selected variant price, image, and stock", () => {
  const view = toProductDetailView({ product, selectedVariant: "SKU-BLUE" });
  expect(view.selectedVariant).toMatchObject({ sku: "SKU-BLUE", stock: 4 });
  expect(view.priceVnd).toBe(product.variants[1].priceAmount);
});

it("joins seller identity only from the decoded public seller response", () => {
  const view = toProductDetailView({
    product,
    seller: { status: "ready", value: publicSeller },
    selectedVariant: null,
  });
  expect(view.seller).toEqual({
    status: "ready",
    id: publicSeller.id,
    name: publicSeller.shopName,
    rating: publicSeller.ratingAvg,
  });
});
```

- [ ] **Step 2: Run tests and confirm presenters are missing**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/catalog/model/search-view.test.ts src/features/product/model/product-view.test.ts
```

Expected: FAIL because the presenter modules do not exist.

- [ ] **Step 3: Implement typed search presentation**

Define:

```ts
export interface SearchResultsView {
  status: "loading" | "empty" | "error" | "partial" | "ready";
  source: "primary" | "fallback";
  query: string;
  resultCount: number;
  products: readonly ProductTileView[];
  errorMessage?: string;
}
```

`SearchPage.tsx` becomes a route composer that reads `readSearchRouteState(searchParams)`, passes every supported endpoint parameter to query options, and renders:

```tsx
<PageContainer>
  <PageHeader title={title} description={resultDescription} />
  <SearchToolbar state={routeState} resultCount={view.resultCount} onChange={updateRoute} />
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
    <aside className="hidden lg:block"><SearchFilters /></aside>
    <SearchResults view={view} />
  </div>
  <MobileFilterDrawer open={filterOpen} state={routeState} onApply={applyFilters} />
</PageContainer>
```

Mobile filter changes are staged in the drawer and written to the URL only on Apply. Sort changes update the URL immediately. Either action resets page to 1.

- [ ] **Step 4: Implement typed product presentation and URL-owned sections**

Extend the product route schema with:

```ts
const productRouteSchema = {
  section: routeParam.enum(["details", "reviews", "questions", "videos"] as const, "details"),
  variant: routeParam.string({ defaultValue: "", maxLength: 100 }),
};
```

Define:

```ts
export interface ProductDetailView {
  id: string;
  title: string;
  media: readonly { id: string; url: string; alt: string }[];
  priceVnd: number;
  originalPriceVnd?: number;
  rating?: number;
  soldCount?: number;
  stockState: "in-stock" | "low-stock" | "unavailable";
  variants: readonly { sku: string; label: string; available: boolean }[];
  selectedVariant?: { sku: string; stock: number };
  seller:
    | { status: "loading" }
    | { status: "unavailable" }
    | { status: "ready"; id: string; name: string; rating?: number };
  trustCues: readonly TrustCue[];
  actions: { addToCart: boolean; buyNow: boolean };
}
```

Create `use-product-seller.ts` inside the product feature. It consumes the
shared `getSeller` endpoint and `PublicSeller` schema, enables the query only
when the decoded product `sellerId` exists, and returns an explicit
loading/unavailable/ready input to `toProductDetailView`. `ProductPage.tsx`
imports the product feature's public route component only; it does not import
the app-owned `use-sellers.ts` hook.
The presenter maps `name` only from decoded `PublicSeller.shopName` and rating
only from `ratingAvg`; product detail does not contain a seller name. It never
substitutes an empty string, product verification, or invented seller identity.
`ProductPage.test.tsx` proves the query receives the decoded product seller ID,
the seller skeleton renders while that query is pending, and a seller failure
does not block product purchase information.
`ProductDetail` uses an unframed two-column region on desktop and one flow on
mobile. The purchase panel places title, rating, sold count, price, variants,
stock, vouchers, delivery, seller trust, and actions in that order. Render the
seller section and contact action only when `view.seller.status === "ready"`.
Use a dimension-stable seller skeleton for `loading` and omit identity/contact
for `unavailable`. Follow
with sections for reviews, video, questions, specifications, and
recommendations.

- [ ] **Step 5: Build a non-overlapping mobile purchase bar**

Use:

```tsx
<div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-[auto_1fr_1fr] border-t border-border bg-card p-2 md:hidden">
  <IconButton label={t("product.contactSeller")} disabled={!canMessage}><MessageCircle /></IconButton>
  <Button variant="outline" disabled={!view.actions.addToCart}>{t("product.addToCart")}</Button>
  <Button disabled={!view.actions.buyNow}>{t("product.buyNow")}</Button>
</div>
```

Add matching page bottom padding. Hide contact seller when the messaging capability lacks a seller ID; do not show a disabled decorative control.

- [ ] **Step 6: Keep route pages thin and remove private cross-feature imports**

`SearchPage.tsx` imports only from `@/features/catalog` and shared modules. `ProductPage.tsx` imports only from `@/features/product`, `@/features/reviews`, `@/features/videos`, and shared modules through their public `index.ts` exports. Move route-specific query/presenter logic out of the page; keep loader prefetch keys identical to rendered query keys.

- [ ] **Step 7: Verify search and product behavior**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/catalog src/features/product src/app/pages/SearchPage.test.tsx src/app/pages/ProductPage.test.tsx
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use Playwright to verify filter/sort/page/section state survives refresh and back/forward navigation. Capture search and product at all four buyer viewports with long titles and missing media.

- [ ] **Step 8: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): modernize catalog and product discovery"
```

### Task 3: Modernize Cart And Checkout Presentation

**Files:**
- Create: `fe/src/features/cart/model/cart-view.ts`
- Create: `fe/src/features/cart/model/cart-view.test.ts`
- Create: `fe/src/features/cart/components/cart-page-view.tsx`
- Create: `fe/src/features/cart/components/seller-cart-group.tsx`
- Create: `fe/src/features/cart/components/cart-line.tsx`
- Create: `fe/src/features/cart/components/cart-summary.tsx`
- Create: `fe/src/features/cart/index.ts`
- Modify: `fe/src/app/pages/CartPage.tsx`
- Create: `fe/src/features/checkout/components/checkout-page-view.tsx`
- Create: `fe/src/features/checkout/components/checkout-stage-panel.tsx`
- Modify: `fe/src/features/checkout/index.ts`
- Modify: `fe/src/app/pages/checkout/CheckoutAddressStep.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutPage.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutPaymentStep.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutReviewStep.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutShippingStep.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutStepper.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutSuccess.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutSummary.tsx`
- Modify: `fe/src/app/pages/checkout/format.ts`
- Modify: `fe/src/app/pages/checkout/index.ts`
- Modify: `fe/src/app/pages/checkout/types.ts`
- Test: `fe/src/app/pages/checkout/CheckoutAddressStep.test.tsx`
- Test: `fe/src/app/pages/checkout/CheckoutPaymentOptions.test.tsx`
- Test: `fe/src/app/pages/checkout/CheckoutReviewStep.test.tsx`
- Test: `fe/src/app/pages/checkout/CheckoutShippingStep.test.tsx`
- Test: `fe/src/app/pages/checkout/CheckoutStepper.test.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/cart/components/cart-page-view.test.tsx`
- Test: `fe/src/features/checkout/components/checkout-page-view.test.tsx`

**Interfaces:**
- Consumes: typed `CartItem`, cart mutations, coupon validation, checkout calculation, shipping/payment options, and Plan 02a submission state.
- Produces: seller-grouped `CartView`, explicit checkout stage presentation, and non-overlapping responsive summaries.

- [ ] **Step 1: Write failing cart grouping and action tests**

Create `cart-view.test.ts`:

```ts
it("groups cart lines by seller without losing variant identity", () => {
  const view = toCartView([
    { productId: "p-1", variantId: "blue", sellerId: "s-1", sellerName: "Shop A", quantity: 1, price: 10, name: "A" },
    { productId: "p-2", variantId: "large", sellerId: "s-1", sellerName: "Shop A", quantity: 2, price: 20, name: "B" },
    { productId: "p-3", sellerId: "s-2", sellerName: "Shop B", quantity: 1, price: 30, name: "C" },
  ]);

  expect(view.groups).toHaveLength(2);
  expect(view.groups[0]?.lines.map((line) => line.key)).toEqual(["p-1:blue", "p-2:large"]);
  expect(view.subtotalVnd).toBe(80);
});
```

Add a component test that verifies quantity pending disables only its line, a removal requires confirmation, and seller-level voucher text appears only when returned by a supported endpoint.

- [ ] **Step 2: Implement the seller-grouped cart view**

Define:

```ts
export interface CartLineView {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  imageUrl?: string;
  priceVnd: number;
  quantity: number;
  sellerId: string;
  sellerName?: string;
}

export interface CartGroupView {
  sellerId: string;
  sellerName?: string;
  lines: readonly CartLineView[];
  subtotalVnd: number;
}

export interface CartView {
  groups: readonly CartGroupView[];
  subtotalVnd: number;
  itemCount: number;
}
```

When `sellerId` is absent, group under stable key `"unknown-seller"` and localized label `"Seller unavailable"`; do not merge it into another known seller. When a seller ID is present but `sellerName` is absent, preserve the ID and leave the name optional; render the localized unavailable label without deriving a name from the identifier. Add a presenter test for both missing-field cases.

- [ ] **Step 3: Recompose CartPage around focused components**

Render:

```tsx
<PageContainer>
  <PageHeader title={t("cart.title")} description={t("cart.itemCount", { count: view.itemCount })} />
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <div className="space-y-4">
      {view.groups.map((group) => <SellerCartGroup key={group.sellerId} group={group} />)}
    </div>
    <aside className="self-start lg:sticky lg:top-32">
      <CartSummary totals={totals} coupon={couponState} onCheckout={handleCheckout} />
    </aside>
  </div>
</PageContainer>
```

Use icon buttons for quantity decrement/increment and removal, each with a localized accessible label. Keep the summary un-sticky on mobile and render it before the mobile nav padding.

- [ ] **Step 4: Recompose checkout without changing submission logic**

`CheckoutPage.tsx` composes address, shipping, coupon, and the Plan 02a
submission controller while delegating presentation:

```tsx
<CheckoutPageView
  step={step}
  steps={steps}
  stage={<CheckoutStagePanel step={step}>{stageContent}</CheckoutStagePanel>}
  summary={<CheckoutSummary {...summaryProps} />}
  recovery={paymentRecovery}
/>
```

Desktop uses a `minmax(0,1fr) 22rem` grid with a sticky summary. Mobile uses one column, a compact stepper with text that wraps, and the primary Next/Place Order action after the current stage. Financial actions use `pending` and cannot double-submit.

Render the enabled `/payment/methods` intersection accepted by
`checkoutProviderSchema`: `COD`, `VNPAY`, `MOMO`, `VIETQR`, `STRIPE`, and
`PAYPAL`. Redirect and embedded-provider recovery surfaces consume the existing
order/payment identity and durable payment key from the Plan 02a controller;
presentation components never generate idempotency keys or call order
placement.

- [ ] **Step 5: Verify cart and checkout states**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/cart src/features/checkout src/app/pages/checkout
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use Playwright to verify guest cart, authenticated merge, quantity error, coupon rejection, address error, payment failure/retry, and success. Assert one order request across payment retry.

- [ ] **Step 6: Review and commit**

Use the master Review Gate with cart and checkout screenshots at 390x844 and 1440x900, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): clarify cart and checkout journeys"
```

### Task 4: Modernize Orders, Returns, Account, And Communication

**Files:**
- Create: `fe/src/features/account/model/account-route-state.ts`
- Create: `fe/src/features/account/components/account-nav.tsx`
- Create: `fe/src/features/account/index.ts`
- Create: `fe/src/features/orders/model/order-view.ts`
- Create: `fe/src/features/orders/model/order-view.test.ts`
- Create: `fe/src/features/orders/components/order-list.tsx`
- Create: `fe/src/features/orders/components/order-detail.tsx`
- Create: `fe/src/features/orders/components/order-timeline.tsx`
- Create: `fe/src/features/orders/index.ts`
- Modify: `fe/src/shared/contracts/api/order.ts`
- Modify: `fe/src/shared/contracts/api/order.test.ts`
- Create: `fe/src/features/returns/components/return-workflow.tsx`
- Create: `fe/src/features/returns/index.ts`
- Modify: `fe/src/app/pages/OrdersPage.tsx`
- Modify: `fe/src/app/pages/OrderDetailPage.tsx`
- Modify: `fe/src/app/pages/ReturnRequestPage.tsx`
- Modify: `fe/src/app/pages/ReturnStatusPage.tsx`
- Modify: `fe/src/app/pages/ProfilePage.tsx`
- Modify: `fe/src/app/pages/WishlistPage.tsx`
- Modify: `fe/src/app/pages/NotificationsPage.tsx`
- Modify: `fe/src/app/components/notifications/notification-preferences-page.tsx`
- Create: `fe/src/app/components/notifications/notification-preferences-page.test.tsx`
- Modify: `fe/src/app/pages/MessagesPage.tsx`
- Modify: `fe/src/app/pages/SellerDetailPage.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`
- Test: `fe/src/features/orders/components/order-detail.test.tsx`
- Test: `fe/src/app/pages/OrdersPage.test.tsx`
- Test: `fe/src/app/pages/ProfilePage.test.tsx`
- Test: `fe/src/app/pages/ReturnRequestPage.test.tsx`
- Test: `fe/src/app/pages/ReturnStatusPage.test.tsx`
- Test: `fe/src/app/pages/SellerDetailPage.test.tsx`

**Interfaces:**
- Consumes: existing order, return, profile, wishlist, notification, messaging, and seller detail endpoints.
- Produces: `OrderView`, status timeline, URL-owned account section, and consistent account async states.

- [ ] **Step 1: Write failing order action and timeline tests**

Create `order-view.test.ts`:

```ts
it("shows only actions valid for the decoded sub-order state", () => {
  const pending = toOrderView({
    detail: { ...orderDetail, subOrders: [{ ...subOrder, fulfillmentStatus: "PENDING_ACCEPTANCE" }] },
    summary: undefined,
  });
  expect(pending.actions).toEqual(["cancel"]);
  const delivered = toOrderView({
    detail: { ...orderDetail, subOrders: [{ ...subOrder, fulfillmentStatus: "DELIVERED" }] },
    summary: undefined,
  });
  expect(delivered.actions).toEqual(["request-return", "buy-again"]);
});

it("uses only contract-backed chronology and does not invent stage timestamps", () => {
  const view = toOrderView({
    detail: {
      ...orderDetail,
      subOrders: [{ ...subOrder, fulfillmentStatus: "SHIPPED" }],
    },
    summary: undefined,
  });
  expect(view.placedAt).toBeUndefined();
  expect(view.timeline).toEqual([
    expect.objectContaining({ id: "current", occurredAt: undefined }),
  ]);
});
```

Map actions only to existing endpoint functions and route links.

- [ ] **Step 2: Implement order list, detail, and return composition**

Define:

```ts
export interface OrderView {
  id: string;
  placedAt?: string;
  status: OrderStatusUi;
  sellerGroups: readonly {
    sellerId: string;
    sellerName?: string;
    items: readonly { id: string; name: string; quantity: number; totalVnd: number }[];
  }[];
  financial: { subtotalVnd: number; shippingVnd: number; discountVnd: number; totalVnd: number };
  timeline: readonly { id: string; labelKey: string; occurredAt?: string; current: boolean }[];
  actions: readonly ("cancel" | "request-return" | "buy-again")[];
}
```

Split the current frontend decoder into the actual list-summary and detail
wire contracts. `OrderListItemResponse` supplies `createdAt`;
`OrderResponse` detail supplies neither `createdAt` nor `updatedAt`.
`toOrderView` accepts decoded detail plus an optional same-ID decoded list
summary from existing query/cache state. It sets `placedAt` only from that
summary. A refreshed or direct detail route without a summary omits the date
and renders only a non-timestamped current-state marker; it never recovers a
timestamp from route state, `Date.now()`, or an unsupported detail field.

Order detail and list contracts expose `sellerId` but no seller name. Keep
`sellerName` optional and render the stable seller ID when no separately decoded
seller-directory result is available; never derive a display name from the ID
or invent one in the presenter.

List cards prioritize order ID, available date, current status, seller, items,
total, and valid next action. Detail uses an unframed summary plus a truthful
timeline and financial definition list. Do not treat an update timestamp as a
fulfillment-stage occurrence. Return forms keep selected sub-order/item IDs and
validate a reason beside the field.

- [ ] **Step 3: Add URL-owned account navigation**

Use query or nested route state for `profile`, `wishlist`, `notifications`, `messages`, and `returns`. Preserve existing top-level paths; `AccountNav` links to those paths and sets `aria-current="page"`. Do not hide top-level URLs behind an in-memory tab.

Use the same `PageHeader`, `AsyncState`, `DataTable`/data-list, `Drawer`, and pagination language across account pages. Keep unread counts and message thread selection truthful to current APIs.

- [ ] **Step 4: Preserve communication and seller-detail capabilities**

Messages expose threads and send controls only when thread IDs exist.
Notifications expose mark-read and preferences only when their current
mutations are available. Seller detail shows shop identity, rating, products,
and contact action from decoded public seller data. A verification badge is
rendered only on a surface whose decoded schema actually contains
`verified: true`; the public seller response does not. No page adds a review
response, seller follow, or support action without an endpoint.

Modernize `notification-preferences-page.tsx` as the implementation owner for
`/notifications/preferences`. Decode its read/update contracts, preserve every
supported toggle, and render explicit loading, save-pending, saved, and error
states. Its focused test covers a successful load/save, rollback after a failed
save, keyboard labels, and the route's exact preference payload.

- [ ] **Step 5: Verify buyer retention routes**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/orders src/features/account src/features/returns src/app/pages/OrdersPage.test.tsx src/app/pages/ReturnRequestPage.test.tsx src/app/pages/ReturnStatusPage.test.tsx src/app/pages/ProfilePage.test.tsx src/app/components/notifications/notification-preferences-page.test.tsx src/app/hooks/use-notifications.test.tsx src/app/hooks/use-messages.test.tsx
pnpm run typecheck
pnpm run lint:i18n
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Use Playwright to verify order list/detail, valid return request, return status, profile, wishlist, notifications/preferences, messaging, and seller detail at 390x844 and 1440x900.

- [ ] **Step 6: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): modernize buyer account journeys"
```

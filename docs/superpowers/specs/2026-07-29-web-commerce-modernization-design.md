# VNShop Web Commerce Modernization Design

**Date:** 2026-07-29
**Status:** Design approved in conversation; pending written-spec confirmation
**Scope:** React web storefront, seller console, and admin console in `fe/`

## 1. Relationship to Existing Specifications

This specification builds on `2026-07-15-cross-platform-ui-architecture-redesign.md`.
It preserves that document's React feature boundaries, state ownership, accessibility
rules, API-contract rules, and generated-token discipline.

For the React web client only, this specification supersedes:

- the visual direction in the 2026-07-15 cross-platform specification;
- the web release strategy in that specification; and
- the visual-only direction in `2026-06-06-frontend-redesign-design.md`.

The Flutter client is outside this scope. Shared mobile behavior and presentation
remain governed by the 2026-07-15 specification.

## 2. Objective

Modernize the complete VNShop React frontend as one coordinated release. The buyer
storefront will retain the familiar information architecture of a high-density
Vietnamese marketplace while receiving a cleaner, more trustworthy visual identity.
Seller and admin experiences will become restrained operational consoles optimized for
repeated work.

The implementation will refactor the existing application in place. It will preserve
routes, gateway authentication, API envelopes, Zod schemas, TanStack Query ownership,
payment behavior, role guards, and supported business workflows.

## 3. Approved Product Decisions

- Keep the VNShop name.
- Use the **Clean Marketplace** visual direction.
- Preserve a Shopee-familiar marketplace format, without cloning Shopee branding,
  proprietary assets, copy, or exact layouts.
- Prioritize buyer conversion first, seller efficiency second, and admin clarity third.
- Modernize buyer, seller, and admin surfaces in the same initiative.
- Release the complete redesign together rather than exposing a mixed old/new
  production interface.
- Use a system-first in-place refactor instead of a cosmetic reskin or parallel SPA.
- Treat mobile web and desktop as equal acceptance targets, with mobile-first layout
  decisions for buyer journeys.
- Treat compile-time type safety, runtime boundary validation, and completed code
  review as release requirements rather than optional cleanup.

## 4. Goals

1. Improve product discovery, comparison, trust, cart comprehension, and checkout
   completion.
2. Make seller product, order, review, and payout workflows faster to scan and operate.
3. Standardize admin queues, decisions, evidence, tables, and system-health views.
4. Replace page-specific styling with a coherent web design system.
5. Split oversized route components into focused, independently testable units.
6. Preserve all supported backend behavior and integration contracts.
7. Eliminate known responsive overlap, unstable layout, clipped text, and oversized
   mobile-footer problems.
8. Ship with explicit loading, empty, partial, error, pending, and success behavior.

## 5. Non-Goals

- Renaming VNShop or changing service names.
- Redesigning the Flutter application.
- Replacing React Router, TanStack Query, Zustand, React Hook Form, Zod, or the gateway
  authentication boundary.
- Changing payment-provider semantics, order idempotency, or backend authorization.
- Adding seller or admin actions unsupported by current APIs.
- Replacing marketplace ranking, recommendation, search, pricing, shipping, or coupon
  algorithms.
- Maintaining separate old and new production themes after launch.
- Reproducing another marketplace pixel for pixel.

## 6. Visual System

### 6.1 Brand Language

VNShop will use a clean, product-forward marketplace identity:

- warm vermilion is the primary web brand and commerce-action color;
- graphite provides high-contrast utility navigation and operational emphasis;
- white and cool neutral surfaces carry most page hierarchy;
- cobalt supports informational and navigational accents;
- green communicates success and verified states;
- amber is reserved for ratings, time-sensitive offers, and commerce urgency;
- red danger semantics remain distinguishable from the brand color through tone,
  labeling, iconography, and context.

Inter remains the primary typeface. Typography uses fixed semantic roles from the
token scale rather than viewport-scaled font sizes. Letter spacing remains zero.

Cards use an 8px radius or less. Repeated product cards, dialogs, and framed tools may
use card treatment; page sections remain unframed bands. Borders and spacing carry
hierarchy more often than shadows.

The current floating theme toggle moves into an account or display-preference menu.
Dark mode remains supported but does not turn the application into a single dark-blue
palette.

### 6.2 Token Ownership

`design-system/tokens.json` remains the source of truth for shared foundations,
including spacing, radii, typography, status colors, targets, and shadows. Generated
files remain generated and are never edited directly.

The implementation will add an explicit web brand namespace to the token source and
generator. The CSS output will expose the approved storefront and console brand
aliases. The Dart output will continue using the existing shared/mobile values until a
separate mobile design is approved. Generator tests must prove that the web rebrand
does not silently change Flutter token values.

`fe/src/styles/theme.css` remains the compatibility and semantic-alias layer over the
generated CSS.

### 6.3 Foundation Components

`src/app/components/ui` will provide consistent:

- buttons and icon buttons;
- text fields, text areas, selectors, checkboxes, toggles, and input groups;
- tabs and segmented controls;
- dialog, confirmation dialog, drawer, and bottom sheet;
- table, data list, toolbar, sorting, filtering, and pagination;
- badge, status indicator, inline alert, toast, and progress feedback;
- skeleton, empty state, and asynchronous-state boundary;
- tooltip for unfamiliar icon-only controls;
- page container, page header, section header, and responsive shell primitives.

Shared commerce patterns will cover:

- product tile and product grid;
- price, original price, discount, rating, sold count, and stock treatment;
- seller identity and verified state;
- voucher, shipping promise, return policy, and buyer-protection cues;
- campaign banner, service shortcut, category rail, flash-sale shelf, Mall section,
  live-commerce section, and recommendation feed.

The existing design-system route becomes the review surface for every component,
theme, state, long-text case, and supported viewport.

## 7. Application Architecture

### 7.1 Shells

The route root will compose three explicit shells:

1. **Storefront shell:** utility navigation, sticky search, account, wishlist, cart,
   categories, buyer footer, and mobile bottom navigation.
2. **Seller shell:** persistent desktop navigation, compact header, shop context,
   notifications, and task-first mobile navigation.
3. **Admin shell:** grouped operational navigation, queue counts, compact header, and
   responsive record inspection.

Authentication pages remain outside the storefront chrome. Payment-return routes keep
their current provider-specific behavior.

### 7.2 Feature Boundaries

Route components become thin composition entry points. Business state, query options,
presenters, and focused views live in bounded feature modules. The target dependency
direction remains:

```text
application shells and route pages
  -> feature public interfaces
  -> shared UI, API transport, configuration, and utilities
```

Features must not import another feature's private files. Compatibility exports may
temporarily preserve existing import paths during development, but they contain no
business logic and are removed before release.

The main decomposition targets are:

- home and campaign merchandising;
- catalog search, filters, sorting, and result presentation;
- product media, purchase information, seller context, reviews, questions, video, and
  recommendations;
- cart grouping, quantity changes, vouchers, totals, and authentication merge;
- checkout address, delivery, coupons, order placement, payment, and return handling;
- seller dashboard, products, orders, reviews, wallet, and settings;
- admin dashboard, commerce, trust and safety, finance, users, and system health.

### 7.3 Routing

Existing public URLs remain stable. Search filters, sorting, pagination, product tabs,
account sections, seller sections, and admin sections are URL-derived where users need
refresh, back-button, or deep-link support.

Seller and admin wildcard areas may become explicit nested routes while preserving
their current external paths and role guards.

## 8. Buyer Experience

### 8.1 Storefront and Homepage

The storefront retains a familiar Vietnamese marketplace hierarchy:

1. utility links and seller entry;
2. prominent sticky search, hot terms, account, wishlist, and cart;
3. campaign media with secondary offers;
4. service shortcuts for vouchers, free shipping, Mall, live commerce, and delivery;
5. horizontally scrollable categories;
6. flash sale;
7. trusted Mall sellers;
8. live commerce and top sellers;
9. personalized recommendations and recently viewed products.

The campaign region is product-led and compact enough to reveal discovery content in
the first viewport. It uses real product or seller imagery, not gradients or decorative
illustrations.

### 8.2 Search and Catalog

- Search remains the primary navigation action.
- URL-owned filters, sorting, pagination, query text, and fallback behavior are
  preserved.
- Desktop uses a scannable filter sidebar and stable result toolbar.
- Mobile uses filter and sort sheets with visible applied-filter summaries.
- Result counts, query source, loading, fallback, empty, and error states remain
  truthful.
- Product tiles use stable image and text dimensions so content cannot resize the grid.

### 8.3 Product Detail

The first product viewport prioritizes:

- media and selected variant;
- title, rating, sold count, price, and discount;
- variants and stock;
- vouchers and delivery estimate;
- seller trust and return policy;
- add-to-cart and buy-now actions.

Seller details, reviews, video, questions, specifications, and recommendations follow
in clear sections. Mobile receives a stable bottom purchase bar that never overlaps
content or system navigation.

### 8.4 Cart and Checkout

Cart items are grouped by seller. Seller-level vouchers, shipping context, stock
changes, price changes, quantity errors, and unavailable items appear inline. The
order summary remains visible without covering cart content.

Checkout separates address, delivery, payment, and final review into explicit stages.
The current authenticated boundary, coupon behavior, order idempotency, provider
selection, and payment-return handling remain unchanged.

### 8.5 Orders, Returns, and Account

Orders and returns prioritize status timelines, shipment tracking, financial summary,
valid next actions, and support access. Account, notifications, messages, wishlist, and
seller-detail screens use the same storefront shell and asynchronous-state language.

## 9. Seller Experience

### 9.1 Console Shell and Dashboard

The seller console uses persistent desktop navigation, a compact top bar, shop context,
notifications, and task-first mobile navigation.

The dashboard prioritizes revenue, orders, conversion signals, inventory warnings,
payout state, and urgent tasks. It uses restrained KPI groups and compact charts rather
than marketing-style cards.

### 9.2 Products

The product list provides searchable, paginated data with publication, price, stock,
sales, media state, and valid actions. Filters and table position remain stable during
background refresh.

The current oversized product modal becomes a focused editor with sections for:

- basic information;
- media and attached video;
- variants;
- pricing;
- inventory;
- publication.

Field validation stays beside the affected control. Unsaved-change and destructive
media actions require confirmation.

### 9.3 Orders and Reviews

Order workflow tabs represent pending, accepted, shipped, completed, and exception
states. Record inspection exposes fulfillment details and only valid next actions
without losing queue position.

The review inbox provides server-backed search, rating filters, product context, and
explicit loading, empty, and failure states. It does not invent response actions that
the backend does not support.

### 9.4 Wallet and Settings

Wallet presentation separates available and pending balances, payout eligibility,
withdrawal requests, and canonical audit history. Existing retry-stable idempotency is
preserved.

Settings organizes supported shop identity, fulfillment, notification, and account
fields. Unsupported configuration is not displayed as a nonfunctional control.

## 10. Admin Experience

### 10.1 Console and Dashboard

Navigation groups work into Overview, Commerce, Trust and Safety, Finance, Users, and
System. Queue counts are visible but restrained.

The dashboard leads with date-controlled marketplace KPIs, revenue and order trends,
seller performance, and operational exceptions requiring action.

### 10.2 Standard Queue Pattern

Orders, coupons, disputes, seller applications, reviews, video moderation, appeals,
payouts, and users share:

- one toolbar and filter language;
- consistent table, status, sorting, pagination, and loading behavior;
- a detail drawer that preserves queue context;
- explicit confirmation, reason, and evidence requirements;
- cache refresh that preserves filters and table position.

### 10.3 Domain Workflows

- Commerce views prioritize state, financial impact, parties, and valid next actions.
- Seller review exposes identity, banking metadata, tier, timing, and decision history.
- Trust and Safety queues combine preview context, risk indicators, and auditable
  decisions.
- Finance separates requested, processing, paid, and failed payout states; manual
  completion keeps current evidence requirements.
- User inspection combines account state, order history, and ban or unban actions.
- System health uses compact service availability, latency, failure, and last-check
  visuals.

Wide tables progressively hide secondary columns. Smaller viewports inspect records in
full-height drawers.

## 11. Data and State

The standard data path is:

```text
endpoint module
  -> Zod response decoding
  -> TanStack Query option or mutation
  -> route or feature composer
  -> focused presentation component
```

Presentation components do not decode backend payloads. Server data remains in
TanStack Query, cross-route interface preferences in Zustand, forms in React Hook
Form, and navigable filter or tab state in the URL.

Optimistic updates are limited to reversible, low-risk actions. Orders, payouts,
refunds, seller decisions, moderation, and fulfillment wait for confirmed responses.
Background refresh retains visible data and user position.

### 11.1 Type-Safety Contract

Type safety is enforced from transport to rendered state:

- TypeScript strict mode and the existing `no-explicit-any` and `no-unsafe-*` ESLint
  rules remain enabled.
- Network responses enter the application as `unknown` and become trusted only after
  Zod decoding in endpoint or envelope modules.
- Request inputs, decoded responses, query keys, query results, mutation variables,
  mutation results, and error variants have explicit types.
- Runtime schemas are the source for inferred wire types when a schema exists; the
  implementation does not maintain a second handwritten interface that can drift.
- Route parameters and URL search parameters are parsed and normalized before feature
  logic consumes them.
- Domain variants use discriminated unions and exhaustive handling instead of
  stringly-typed branching.
- `any`, double assertions, unchecked `as` casts, non-null assertions used to silence
  uncertainty, and `@ts-ignore` are prohibited in changed production code.
- A narrowly justified assertion may be used only when TypeScript cannot express an
  invariant already enforced at runtime. It must be local, documented, and covered by
  a test.
- Shared identifiers, statuses, money values, and provider names reuse canonical
  schemas or types rather than page-local string unions.
- Presentation components receive typed view data and callbacks; they do not inspect
  unvalidated API envelopes.
- Type errors, unsafe lint findings, and stale generated token or schema outputs block
  integration.

## 12. Error and Asynchronous States

- Skeletons reserve final dimensions and prevent layout shifts.
- Query errors never collapse into empty states.
- Field validation appears beside the affected input.
- Business conflicts appear within the affected workflow with a corrective action.
- Recoverable network failures provide retry while preserving user input.
- Authentication failures continue through the gateway refresh boundary.
- Unknown route failures reach an error boundary that can expose correlation details
  for support without exposing secrets.
- Empty states explain what is absent and provide one relevant next action.
- Destructive and financial actions expose pending state and cannot be double-submitted.

## 13. Accessibility and Localization

- Meet WCAG 2.1 AA for keyboard navigation, focus, semantics, contrast, landmarks, and
  reduced motion.
- Keep interactive targets at least 44px.
- Give icon-only controls accessible names and tooltips.
- Support Vietnamese and English text expansion without clipped actions or columns.
- Keep locale-aware dates, numbers, and VND formatting in shared formatters.
- Update the document language when locale changes.
- Verify 200% text scaling on critical buyer and operational workflows.
- Avoid using color as the only status or validation signal.

## 14. Verification

### 14.1 Component and Integration Tests

- strict type-check and unsafe-code lint coverage for every changed module;
- token generation and web/mobile isolation tests;
- primitive behavior and accessibility tests;
- commerce-pattern tests for long titles, missing images, discounts, stock, seller
  trust, and unavailable actions;
- feature presenter, hook, query, and mutation tests;
- route, role-guard, URL-state, and cache-preservation tests;
- loading, empty, partial, error, pending, and ready-state coverage.

### 14.2 End-to-End Tests

Playwright verifies:

- buyer discovery, product selection, cart, checkout, order, return, account,
  notifications, and messaging journeys;
- seller product, order, review, wallet, payout, and settings workdays;
- admin approval, moderation, order, dispute, coupon, payout, user, and system-health
  workdays;
- keyboard and Axe checks;
- screenshots at 390, 768, 1024, and 1440px;
- sticky-header, bottom-navigation, drawer, modal, table, and text-overflow behavior.

### 14.3 Release Gates

The coordinated release requires:

- type checking;
- lint, localization, and token checks;
- formatting check;
- unit and integration tests;
- production build;
- accessibility suite;
- complete buyer, seller, admin, and cross-persona journey suites;
- desktop and mobile screenshot review;
- no unresolved critical or high-severity regression.

### 14.4 Review Protocol

Every implementation slice must pass the following review sequence before it can be
considered complete:

1. **Author self-review:** inspect the full diff for unrelated changes, duplicated
   types, unsafe assertions, missing states, accessibility regressions, responsive
   behavior, localization, and unsupported backend assumptions.
2. **Automated evidence:** run the smallest relevant type, lint, unit, integration,
   accessibility, and build checks; record the commands and results.
3. **Independent code review:** review behavior, type boundaries, API contracts,
   component ownership, data flow, error handling, test adequacy, and visual
   consistency. Findings are ordered by severity and tied to file and line references.
4. **Finding resolution:** resolve every critical and high finding. Medium and low
   findings are either resolved or explicitly documented with rationale and follow-up
   ownership.
5. **Integrated review:** after all slices are combined, review the complete buyer,
   seller, and admin diff and run the full coordinated-release gates.

Review approval cannot rely on screenshots alone. It requires passing type and
behavioral evidence. A review that finds no defects must still state remaining test
gaps and residual risks.

## 15. Coordinated Release Strategy

Development proceeds in internally reviewable slices even though production launch is
coordinated:

1. web brand tokens, primitives, design-system coverage, and shells;
2. buyer discovery and purchase journey;
3. buyer retention and account journey;
4. seller console;
5. admin console;
6. cross-persona hardening, performance, accessibility, and visual verification.

Temporary compatibility exports and internal preview switches may support development.
They are removed before release. Production does not expose a mixture of old and new
screens.

## 16. Acceptance Criteria

The redesign is ready to release only when:

1. VNShop is recognizable as a distinct clean marketplace rather than a generic
   template or another marketplace clone.
2. Every existing public route and role-gated workflow remains reachable.
3. Buyer, seller, and admin journey tests pass against production builds.
4. Search, cart, checkout, fulfillment, payment, payout, and moderation contracts
   retain current semantics.
5. Critical routes expose explicit loading, empty, partial, error, pending, and success
   states.
6. No supported viewport has sticky-navigation overlap, horizontal page overflow,
   clipped primary actions, unstable product tiles, or an oversized footer.
7. No critical Axe violation remains.
8. Route state survives refresh, deep links, and browser back or forward navigation.
9. Unsupported backend behavior is not represented as functional UI.
10. Shared token generation proves the web rebrand does not alter Flutter presentation.
11. The production build introduces no unexplained key-route gzip-compressed JavaScript
    regression greater than 10% from the production build recorded before implementation.
12. Representative home, search, product, cart, and checkout runs target median LCP at
    or below 2.5 seconds and CLS below 0.1 across three Lighthouse runs using Chromium,
    a 390x844 viewport, four-times CPU slowdown, 1.6 Mbps download throughput, 150 ms
    request latency, the production frontend build, and seeded backend data.
13. Changed production code contains no unvalidated network payload, explicit `any`,
    unsafe suppression, duplicated wire contract, or unresolved type-check failure.
14. Every implementation slice and the integrated release have recorded self-review,
    automated verification, independent review, and finding-resolution evidence.

## 17. Principal Risks and Mitigations

| Risk | Mitigation |
|---|---|
| A coordinated release creates a large integration surface. | Develop in bounded slices, keep routes stable, integrate continuously, and require full cross-persona journeys before launch. |
| Web brand-token changes affect Flutter unintentionally. | Add a tested web token namespace and retain existing Dart values. |
| Page decomposition changes behavior while moving code. | Characterize current behavior first, preserve public feature interfaces, and verify route and contract tests during each extraction. |
| A Shopee-familiar format becomes an imitation. | Retain interaction familiarity but use VNShop typography, palette, imagery, spacing, copy, and component construction. |
| Promotional density harms accessibility or performance. | Bound campaign dimensions, lazy-load below-fold media, reserve image space, reduce motion, and enforce performance and Axe gates. |
| Operational consoles become visually decorative. | Use restrained shells, standardized tables and drawers, compact charts, and task-first hierarchy. |
| Unsupported backend capabilities appear in the redesign. | Bind every action to an existing typed endpoint and omit unsupported controls. |
| Refactoring introduces type escape hatches or duplicate contracts. | Decode `unknown` at boundaries, infer from canonical schemas, prohibit unsafe suppression in changed code, and review every assertion. |
| A large coordinated diff receives shallow review. | Review each bounded slice independently, resolve findings continuously, and repeat review across the integrated release. |

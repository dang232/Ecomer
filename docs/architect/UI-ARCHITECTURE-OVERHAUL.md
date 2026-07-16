# VNShop UI Architecture Overhaul

**Status:** Active migration checkpoint, 2026-07-16

## Purpose

This guide defines how VNShop's React web client and Flutter mobile client should be extended during the UI overhaul. It is written for an engineer who needs to migrate or add a screen without reintroducing duplicated display logic, transport assumptions, fake state, or platform-specific business rules.

The post-read action is concrete: an engineer should be able to implement one vertical feature slice from API response to responsive UI while preserving the same business meaning on web and mobile.

The overhaul is not a visual reskin. It aligns contracts, state ownership, routing, presentation models, reusable controls, accessibility, and all loading, empty, error, success, and disabled states.

## Required Data Flow

Every feature follows the same dependency direction:

```text
API payload
  -> transport decoder or data model
  -> repository or query boundary
  -> controller, hook, BLoC, or Cubit
  -> presentation mapper
  -> view
```

Each layer has one job:

| Layer | Owns | Must not own |
|---|---|---|
| Transport | Envelope parsing, wire names, optional fields, backward compatibility | Localized labels or visual state |
| Repository/query | Fetching, caching, mutations, typed failures | Widget or component concerns |
| Controller | User intent, async lifecycle, pagination, authoritative totals | Raw JSON parsing or layout |
| Presentation mapper | Localized labels, formatting, action availability, display variants | Network requests |
| View | Composition, interaction, responsive layout, semantics | Complex business conditions |

Do not decode the same API response in multiple components. Do not filter a server-filtered page again in the UI. Do not infer business status from translated text.

## State Ownership

VNShop uses one owner for each kind of state:

| State | Owner |
|---|---|
| Shareable search, filter, sort, pagination, and selected tab | Route or URL |
| Remote data and mutation lifecycle | Query hook, repository, BLoC, or Cubit |
| Cross-screen session state | Existing auth, cart, wishlist, locale, and theme providers |
| Temporary interaction state | Local component or widget state |
| Localized display labels and formatting | Presentation mapper or formatter |

Remote state must use explicit loading, ready, empty, partial-error, and terminal-error representations. Existing content remains visible when a refresh, pagination request, or recoverable mutation fails.

## Design System

Semantic design tokens are shared from one source and generated into native React CSS and Flutter Dart outputs. Platform controls remain native implementations.

The token contract covers:

- Semantic foreground, background, border, action, status, and focus colors
- Typography roles rather than screen-specific font values
- A consistent spacing scale
- Radius values capped at 8px for standard cards and surfaces
- Restrained elevation and shadows
- Minimum 44px web and 48dp mobile interactive targets
- Visible keyboard focus and sufficient contrast
- Reduced-motion behavior

Screens should compose shared buttons, icon buttons, fields, surfaces, dialogs, tabs, status indicators, skeletons, page containers, and async-state views. A feature may wrap a primitive for domain meaning, but should not clone its accessibility or interaction behavior.

## Routing And Access

Routes are typed and centralized. Route parsing validates identifiers and rejects unsafe redirect targets.

The current access rules are:

- An authenticated administrator with no explicit safe destination lands in the admin console.
- A safe explicit destination is preserved after authentication.
- An authenticated user without the required role is sent to a clear access-denied screen.
- Backend authorization remains the security boundary; hiding a client route is not an access-control mechanism.
- Flutter route-scoped BLoCs and Cubits resolve repositories from the composition root and do not create duplicate service graphs.
- Product and order detail screens load their entity by route identifier instead of depending on list-page memory.

## Completed Vertical Slices

This is a checkpoint, not a claim that the full redesign is complete.

| Area | Implemented architecture and behavior |
|---|---|
| Foundations | Shared generated tokens, typed route state, async-state primitives, React UI primitives, Flutter composition root, and native design-system components |
| Discovery | Reusable product presentation and grids, responsive home/catalog surfaces, server-backed search filters and sorting, truthful totals, and robust media/stock decoding |
| Product detail | Route-driven loading, real cart and wishlist actions, responsive purchase controls, gallery states, seller navigation, and connected review surfaces |
| Reviews | Typed review controller/presentation boundary, localized summary and form states, automated moderation with manual escalation, verified-purchase support, and corrected review timestamps |
| Cart | Real mobile cart repository state, item selection ownership, reusable cart rows and totals, coupon states, and responsive controls |
| Checkout | Selected-item checkout, typed failures, repository-owned payment endpoints, BLoC orchestration, address editing, payment retry safety, and responsive summary/actions |
| Orders | Backend-compatible decoders, authoritative page totals, server-side status filters, list and detail controllers, localized presentation mapping, cancellation flow, and responsive order timelines |
| Wishlist | Real mobile wishlist repository and state flow plus reusable product-grid presentation |
| Authentication | Safe redirect handling, role-aware default destination, explicit wrong-role state, and tested direct navigation behavior |

## Contract Corrections

The UI work exposed backend contract defects that had to be corrected rather than hidden in components.

### Order summaries

Order summary status now represents fulfilment progress, not payment progress. Mixed seller sub-orders resolve to the least advanced active fulfilment state, while cancellation remains terminal only when appropriate. Projection events include fulfilment status, item count, and total amount. A database migration repairs existing summary rows.

React and Flutter normalize legacy and current wire values at their transport boundaries. Payment status never promotes a shipped order to delivered.

### Product search

The search read model carries product media and availability data required by product cards. Filters and sorting are server-owned, while clients preserve URL or route state and display authoritative result counts.

### Review moderation

Review submission, purchase verification, automatic policy decisions, and manual moderation are separate responsibilities. Reviews that need human judgment enter an admin queue; safe reviews do not require an administrator to approve every submission. Admin actions consume valid timestamps and return typed failures.

## Screen Implementation Checklist

Before migrating a screen, answer:

1. What is the screen's primary user goal and primary action?
2. Which state belongs in the route, remote controller, session provider, or local UI?
3. Which API decoder is authoritative for this payload?
4. Which presentation mapper owns labels, formatting, and action availability?
5. What appears during initial loading, refresh, empty data, partial failure, terminal failure, success, and disabled mutations?
6. Does long Vietnamese or English text wrap without changing control geometry?
7. Does the layout work at compact, medium, and expanded widths and at 200% text or browser zoom?
8. Are all actions keyboard and screen-reader operable with a visible focus state?
9. Can a retry repeat a payment, order, or review mutation? If so, enforce idempotency before polishing the UI.
10. Is any real feature being replaced by fake data or a placeholder? If yes, stop and connect the existing domain boundary.

## Verification Contract

A slice is complete only after all of the following:

- Focused regression tests demonstrate the original bug and the corrected behavior.
- The relevant React, Flutter, and service suites pass.
- Static analysis and production builds pass for affected applications.
- Changed screens are inspected at compact, tablet, and desktop widths.
- Long text, 200% scaling, keyboard navigation, reduced motion, loading, empty, error, partial, and large-data states are exercised.
- Docker-backed contract or journey tests confirm the clients and services agree at runtime.

Passing compilation alone is not completion.

### Checkpoint evidence (2026-07-16)

- React: 4 design-token tests, 554 full-suite tests, type checking, production build, formatting, and lint gates passed. ESLint still reports 32 non-blocking warnings in legacy surfaces.
- React focused slices: 113 architecture/auth tests, 102 catalog/review/checkout tests, and 92 seller/admin/video tests passed.
- Flutter: static analysis reported no issues, all 193 tests passed, and the debug APK built successfully.
- Product service: 26 moderation, verified-purchase, publication, cache, and event tests passed.
- Search service: 12 query, document, fallback, and persistence contract tests passed.
- Order service: 6 projection, event, status, and exception-handler tests passed.
- Gateway, session, payment, and notification boundaries: the gateway package built; 26 user-session, 1 payment-method, and 32 notification tests passed.
- Playwright: collection-only validation parsed 203 tests across 54 files.

Docker-backed runtime and journey execution was intentionally deferred after Docker access was disabled. It remains a required release gate and is not implied by the static and isolated results above.

## Remaining Migration Work

The next priority is to finish Stage 4 rather than expand the foundation again:

1. Complete account, notifications, and messaging flows, removing remaining placeholder destinations and fake mobile profile data.
2. Convert seller console tabs into nested routes with status-specific fetching, pagination, responsive data views, and shared product forms.
3. Convert admin queues into nested routes with consistent table, empty, loading, retry, confirmation, and failure feedback.
4. Run the complete React, Flutter, service, Docker journey, responsive, and accessibility verification matrix.

Avoid broad primitive refactors while these flows are incomplete. Add a new abstraction only when a migrated vertical slice proves that the shared behavior is real.

# Task 1 Report: Complete Buyer Account, Order, Return, And Communication Features

## Status

Completed in the current worktree fork and kept scoped to the Task 1 buyer inventory plus required focused tests.

## What I Implemented

- Added a URL-owned buyer account feature shell:
  - `fe/src/features/account/model/account-route-state.ts`
  - `fe/src/features/account/components/account-nav.tsx`
  - `fe/src/features/account/index.ts`
- Added a typed buyer order presenter and feature components:
  - `fe/src/features/orders/model/order-view.ts`
  - `fe/src/features/orders/model/order-view.test.ts`
  - `fe/src/features/orders/components/order-list.tsx`
  - `fe/src/features/orders/components/order-detail.tsx`
  - `fe/src/features/orders/components/order-timeline.tsx`
  - `fe/src/features/orders/index.ts`
- Added a return workflow feature component:
  - `fe/src/features/returns/components/return-workflow.tsx`
  - `fe/src/features/returns/index.ts`
- Split buyer order contracts for truthful summary vs detail handling while preserving the legacy `orderSchema` surface:
  - `orderListItemSchema`
  - `orderDetailSchema`
- Reworked buyer pages to compose the new presenters/features:
  - `OrdersPage`
  - `OrderDetailPage`
  - `ReturnRequestPage`
  - `ReturnStatusPage`
  - `ProfilePage`
  - `WishlistPage`
  - `NotificationsPage`
  - `MessagesPage`
  - `SellerDetailPage`
- Replaced the notification preferences route implementation with direct decoded query/mutation ownership, including explicit loading, save-pending, saved, and error states.
- Added focused tests for:
  - order presenter truthfulness
  - account nav URL ownership
  - notification preferences load/save/rollback
  - seller contact action
  - updated return request flow

## TDD Evidence

### RED

Command:

```powershell
pnpm exec vitest run src/features/orders/model/order-view.test.ts src/features/account/components/account-nav.test.tsx src/app/components/notifications/notification-preferences-page.test.tsx src/shared/contracts/api/order.test.ts src/app/pages/SellerDetailPage.test.tsx
```

Observed expected failures before implementation:

- missing `fe/src/features/orders/model/order-view.ts`
- missing `fe/src/features/account/components/account-nav.tsx`
- missing `orderListItemSchema` / `orderDetailSchema`
- missing seller contact action on `SellerDetailPage`
- notification preferences route still depended on the old hook-owned implementation and lacked the required save/rollback state behavior

### GREEN

Focused buyer verification command:

```powershell
pnpm exec vitest run src/features/orders src/features/account src/features/returns src/app/pages/OrdersPage.test.tsx src/app/pages/ReturnRequestPage.test.tsx src/app/pages/ReturnStatusPage.test.tsx src/app/pages/ProfilePage.test.tsx src/app/pages/SellerDetailPage.test.tsx src/app/components/notifications/notification-preferences-page.test.tsx src/app/hooks/use-notifications.test.tsx src/app/hooks/use-messages.test.tsx src/shared/contracts/api/order.test.ts
```

Result:

- `11` test files passed
- `48` tests passed

TypeScript verification command:

```powershell
pnpm run typecheck
```

Result:

- passed across app, test, e2e, and node tsconfig targets

## Tests Run

1. Initial red run:
   - `pnpm exec vitest run src/features/orders/model/order-view.test.ts src/features/account/components/account-nav.test.tsx src/app/components/notifications/notification-preferences-page.test.tsx src/shared/contracts/api/order.test.ts src/app/pages/SellerDetailPage.test.tsx`
2. Intermediate focused buyer suite:
   - `pnpm exec vitest run src/features/orders src/features/account src/features/returns src/app/pages/OrdersPage.test.tsx src/app/pages/ReturnRequestPage.test.tsx src/app/pages/ReturnStatusPage.test.tsx src/app/pages/ProfilePage.test.tsx src/app/components/notifications/notification-preferences-page.test.tsx src/app/hooks/use-notifications.test.tsx src/app/hooks/use-messages.test.tsx`
3. Final focused buyer suite:
   - `pnpm exec vitest run src/features/orders src/features/account src/features/returns src/app/pages/OrdersPage.test.tsx src/app/pages/ReturnRequestPage.test.tsx src/app/pages/ReturnStatusPage.test.tsx src/app/pages/ProfilePage.test.tsx src/app/pages/SellerDetailPage.test.tsx src/app/components/notifications/notification-preferences-page.test.tsx src/app/hooks/use-notifications.test.tsx src/app/hooks/use-messages.test.tsx src/shared/contracts/api/order.test.ts`
4. TypeScript:
   - `pnpm run typecheck`
5. Self-review hygiene:
   - `git diff --check -- <task paths>`

## Files Changed

- `fe/src/features/account/model/account-route-state.ts`
- `fe/src/features/account/components/account-nav.tsx`
- `fe/src/features/account/components/account-nav.test.tsx`
- `fe/src/features/account/index.ts`
- `fe/src/features/orders/model/order-view.ts`
- `fe/src/features/orders/model/order-view.test.ts`
- `fe/src/features/orders/components/order-list.tsx`
- `fe/src/features/orders/components/order-detail.tsx`
- `fe/src/features/orders/components/order-timeline.tsx`
- `fe/src/features/orders/index.ts`
- `fe/src/features/returns/components/return-workflow.tsx`
- `fe/src/features/returns/index.ts`
- `fe/src/shared/contracts/api/order.ts`
- `fe/src/shared/contracts/api/order.test.ts`
- `fe/src/app/pages/OrdersPage.tsx`
- `fe/src/app/pages/OrderDetailPage.tsx`
- `fe/src/app/pages/ReturnRequestPage.tsx`
- `fe/src/app/pages/ReturnRequestPage.test.tsx`
- `fe/src/app/pages/ReturnStatusPage.tsx`
- `fe/src/app/pages/ProfilePage.tsx`
- `fe/src/app/pages/WishlistPage.tsx`
- `fe/src/app/pages/NotificationsPage.tsx`
- `fe/src/app/components/notifications/notification-preferences-page.tsx`
- `fe/src/app/components/notifications/notification-preferences-page.test.tsx`
- `fe/src/app/pages/MessagesPage.tsx`
- `fe/src/app/pages/SellerDetailPage.tsx`
- `fe/src/app/pages/SellerDetailPage.test.tsx`
- `fe/src/app/lib/i18n/en.json`
- `fe/src/app/lib/i18n/vi.json`

## Self-Review Findings

- Kept `toOrderView` truthful by reading `placedAt` only from a same-ID cached list summary and never from detail-only state.
- Kept buyer actions restricted to existing supported capabilities:
  - `cancel`
  - `request-return`
  - `buy-again`
  - seller contact via existing messaging route
- Kept notification preferences contract-backed by preserving all supported toggles in the outgoing payload, including defaults for known-but-unspecified types.
- Did not expand into unrelated suite debugging beyond the focused buyer slice and touched-code typecheck.

## Concerns

- No blocking concerns for Task 1.
- I did not run the full repository verification matrix beyond the focused buyer tests and `pnpm run typecheck`, per the scope instruction to avoid expanding into unrelated debugging.

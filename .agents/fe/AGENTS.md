# Frontend (fe/)

<!-- Parent: ../AGENTS.md -->

**Stack:** React 18, Vite 6, TanStack Query 5, React Router 7, Tailwind 4, i18next, Zod, Playwright

## GENERATED

2026-07-10

## OVERVIEW

VNShop React SPA frontend. Single Page Application (SPA) built with React 18 and Vite 6. Communicates with the backend through Spring Cloud Gateway at `:8080`. Authenticates through the gateway's native httpOnly-cookie boundary; Keycloak stays internal to the service network.

## PORTS

| Environment | Port | URL |
|-------------|------|-----|
| Dev server | 5173 | http://localhost:5173 |
| Docker (nginx) | 3000 | http://localhost:3000 |
| Gateway (backend) | 8080 | http://localhost:8080 |
| Keycloak | internal | Docker network only; browser auth uses the gateway |

## QUICK START

```bash
cd fe
cp .env.example .env.local
npm install
npm run dev
```

## DIRECTORY STRUCTURE

```
fe/
├── src/
│   ├── app/
│   │   ├── App.tsx                 # ErrorBoundary > VNShopProvider > Router
│   │   ├── routes.ts               # React Router 7 routes with role-gated access
│   │   ├── pages/                  # Page components (lazy-loaded with Suspense)
│   │   │   ├── HomePage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── SearchPage.tsx
│   │   │   ├── ProductPage.tsx
│   │   │   ├── CartPage.tsx
│   │   │   ├── checkout/index.ts   # Checkout flow
│   │   │   ├── OrdersPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── WishlistPage.tsx
│   │   │   ├── seller/index.tsx    # Seller dashboard (SELLER role)
│   │   │   ├── admin/index.tsx    # Admin panel (ADMIN role)
│   │   │   ├── MessagesPage.tsx
│   │   │   ├── NotificationsPage.tsx
│   │   │   ├── SellerDetailPage.tsx
│   │   │   ├── DesignSystemPage.tsx
│   │   │   └── ...
│   │   ├── components/             # Shared UI components
│   │   │   ├── ui/               # Base UI components
│   │   │   ├── notifications/   # Notification components
│   │   │   ├── search-autocomplete.tsx
│   │   │   ├── language-switcher.tsx
│   │   │   ├── facet-list.tsx
│   │   │   └── image-with-fallback.tsx
│   │   ├── hooks/                 # Custom React hooks
│   │   │   ├── use-auth.tsx      # Native gateway auth state
│   │   │   ├── use-cart.ts        # TanStack Query for cart
│   │   │   ├── use-orders.ts
│   │   │   ├── use-products.ts
│   │   │   ├── use-wishlist.ts   # localStorage (until BE-8)
│   │   │   ├── use-notifications.ts
│   │   │   ├── use-flash-sale.ts
│   │   │   ├── use-recommendations.ts
│   │   │   ├── use-search.ts
│   │   │   ├── use-search-facets.ts
│   │   │   ├── use-search-suggestions.ts
│   │   │   ├── use-categories.ts
│   │   │   ├── use-sellers.ts
│   │   │   ├── use-profile.ts
│   │   │   ├── use-countdown.ts
│   │   │   ├── use-page-visible.ts
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── client.ts     # Fetch wrapper, ApiResponse<T> decode
│   │   │   │   ├── envelope.ts    # Zod schema + ApiError class
│   │   │   │   ├── error-parser.ts
│   │   │   │   ├── product-mapper.ts
│   │   │   │   └── endpoints/    # API endpoint definitions
│   │   │   │       ├── cart.ts
│   │   │   │       ├── products.ts
│   │   │   │       ├── orders.ts
│   │   │   │       ├── checkout.ts
│   │   │   │       ├── payment.ts
│   │   │   │       ├── users.ts
│   │   │   │       ├── wishlist.ts
│   │   │   │       ├── search.ts
│   │   │   │       ├── categories.ts
│   │   │   │       ├── sellers.ts
│   │   │   │       ├── notifications.ts
│   │   │   │       ├── messaging.ts
│   │   │   │       ├── flash-sale.ts
│   │   │   │       ├── coupons.ts
│   │   │   │       └── recommendations.ts
│   │   │   ├── auth/
│   │   │   │   ├── native-auth.ts  # Gateway login/refresh/logout boundary
│   │   │   │   └── role-guard.tsx # RequireAuth, RequireRole components
│   │   │   ├── query-client.ts    # TanStack Query configuration
│   │   │   ├── i18n/index.ts      # i18next configuration
│   │   │   ├── format.ts           # Date/currency formatters
│   │   │   ├── domain-constants.ts
│   │   │   └── domain-enums.ts
│   │   └── types/
│   │       └── api/               # Zod API type definitions
│   │           ├── index.ts
│   │           ├── product.ts
│   │           ├── cart.ts
│   │           ├── order.ts
│   │           ├── user.ts
│   │           ├── seller.ts
│   │           └── ...
│   ├── features/
│   │   └── videos/                # Video feature module
│   ├── imports/                   # Type-only imports (auto-generated)
│   ├── utils/                     # Utility functions
│   ├── styles/
│   │   ├── globals.css
│   │   ├── fonts.css
│   │   ├── tailwind.css
│   │   └── index.css
│   └── main.tsx                   # Entry: QueryClientProvider > AuthProvider > App
├── e2e/                           # Playwright E2E tests
│   ├── _helpers.ts
│   ├── a11y.spec.ts              # Accessibility tests
│   ├── auth-forms-ui.spec.ts
│   ├── buyer-happy-path.spec.ts
│   ├── cart-ui.spec.ts
│   ├── checkout-ui.spec.ts
│   ├── dark-mode-ui.spec.ts
│   ├── flash-sale-ui.spec.ts
│   ├── home-page-ui.spec.ts
│   ├── search-filters-ui.spec.ts
│   ├── search-product-ui.spec.ts
│   ├── seller-dashboard-ui.spec.ts
│   ├── seller-orders-ui.spec.ts
│   ├── profile-ui.spec.ts
│   ├── wishlist-ui.spec.ts
│   ├── workday-*.spec.ts          # Full workflow tests
│   └── ...
├── playwright.config.ts
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── Dockerfile
```

## KEY PATTERNS

### Routing
- React Router 7 with `createBrowserRouter`
- Lazy-loaded pages with `Suspense` + `ErrorBoundary`
- Role-gated routes: `RequireAuth`, `RequireRole` components
- Data loading via TanStack Query `loader` functions for prefetching

### State Management
- **Server state:** TanStack Query v5
- **Client state:** Zustand (for global UI state)
- **Form state:** React Hook Form + Zod validation

### API Communication
- Custom fetch wrapper in `lib/api/client.ts`
- All responses wrapped in `ApiResponse<T>`:
  ```typescript
  interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    errorCode?: string;
    timestamp: string;
  }
  ```
- Gateway base URL: `VITE_API_URL` (default `http://localhost:8080`)
- Idempotency: `Idempotency-Key` header required for `POST /orders`
- Correlation IDs: `X-Correlation-Id` header for distributed tracing

### Authentication
- Native gateway login, registration, refresh, and logout endpoints
- Refresh token stored in an httpOnly, SameSite cookie; access token stays in memory
- Gateway derives `x-user-id` from JWT bearer token
- Keycloak is internal to the Docker/Kubernetes service network; only selected OIDC
  protocol resources are proxied for optional broker/reset flows, never the admin UI

### Styling
- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- `@figma/astraui` component library
- CSS custom properties for theming
- Motion for animations

### Testing
- **Unit:** Vitest + React Testing Library + happy-dom
- **E2E:** Playwright with `@axe-core/playwright` for accessibility
- Test files co-located: `*.test.{ts,tsx}` next to source

## NPM SCRIPTS

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server with HMR (port 5173) |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run typecheck` | TypeScript only, no emit |
| `npm run preview` | Serve built `dist/` for smoke test |
| `npm run test` | Vitest unit tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:a11y` | Accessibility E2E tests |
| `npm run lint` | ESLint |
| `npm run lint:i18n` | Check i18n keys |
| `npm run lint:tokens` | Check design tokens |
| `npm run lint:all` | All linters |
| `npm run format` | Prettier format |
| `npm run format:check` | Prettier check |
| `npm run verify` | Full: typecheck + lint + test + build |

## TECH STACK

| Category | Technology | Version |
|----------|------------|---------|
| Framework | React | 18.3.1 |
| Build tool | Vite | 6.3.5 |
| Language | TypeScript | 5.6.3 |
| Data fetching | TanStack Query | 5.100.10 |
| Routing | React Router | 7.15.0 |
| Styling | Tailwind CSS | 4.1.12 |
| i18n | i18next | 26.2.0 |
| Validation | Zod | 4.4.3 |
| Forms | React Hook Form | 7.55.0 |
| State | Zustand | 5.0.2 |
| Animations | Motion | 12.23.24 |
| E2E Testing | Playwright | 1.60.0 |
| Unit Testing | Vitest | 2.1.9 |
| Auth | Gateway native cookie boundary + Keycloak server-side provider | - |

## WORKING IN FE/

### Starting Development

```bash
cd fe
npm run dev
# Opens at http://localhost:5173
```

### Running Tests

```bash
# Unit tests
npm test

# Unit tests in watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e:ui

# Accessibility tests
npm run test:a11y

# Full verification
npm run verify
```

### Building for Production

```bash
npm run build
# Output in dist/
```

### Docker

```bash
# Run frontend in Docker
docker compose --profile apps up -d frontend
# Served by nginx on port 3000
```

## BACKEND CONTRACT

### API Response Format
All backend responses follow `ApiResponse<T>`:
```typescript
{
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
  timestamp: string;
}
```

### Endpoints
- **Gateway:** `VITE_API_URL` (default `http://localhost:8080`)
- **Cart:** Keyed off JWT (`x-user-id` derived by gateway)
- **Orders:** Requires `Idempotency-Key` header
- **Tracing:** `X-Correlation-Id` for Jaeger (`http://localhost:16686`)

### Open Backend Prerequisites (FE Impact)
- **F23 - Variants:** ProductPage color/size selector (UI-only currently)
- **F35 - Guest cart:** Anonymous users can't add to cart
- **F36 - Wishlist API:** Currently localStorage, pending `/users/me/wishlist`
- **Shipping tracking:** `/shipping/track/*` surfaces `subOrders[*].trackingCode`
- **Push/SSE:** Notifications poll every 30s (Page Visibility-gated)

## ESLINT RULES (Strict)

- `no-explicit-any: error` - No `any` types allowed
- `consistent-type-imports` - Use `import type` for types
- `no-unsafe-*` - Strict null/typed checks
- Test files (`*.test.{ts,tsx}`) excluded from strict rules

## ENVIRONMENT VARIABLES

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Gateway URL |

## KEY FILES

| File | Purpose |
|------|---------|
| `src/main.tsx` | App entry: QueryClientProvider, AuthProvider, Router |
| `src/app/App.tsx` | Root component with ErrorBoundary |
| `src/app/routes.ts` | All routes with lazy loading and guards |
| `src/app/lib/api/client.ts` | Fetch wrapper, ApiResponse decoding |
| `src/app/lib/auth/native-auth.ts` | Gateway login/refresh/logout boundary |
| `src/app/lib/auth/role-guard.tsx` | Auth/role guards |
| `src/app/lib/query-client.ts` | TanStack Query setup |
| `src/app/lib/i18n/index.ts` | i18next config |
| `vite.config.ts` | Vite configuration |
| `playwright.config.ts` | Playwright E2E config |
| `tailwind.config.js` | Tailwind configuration |
| `eslint.config.js` | ESLint rules |

## AI AGENT INSTRUCTIONS

When working on this frontend:

1. **Always run typecheck first:** `npm run typecheck`
2. **Test before claiming completion:** Run relevant tests
3. **Check existing patterns:** Look at similar components/hooks before creating new ones
4. **Follow the structure:** Feature-based organization in `src/app/`
5. **Use Zod for validation:** All API responses should be typed with Zod
6. **TanStack Query for data:** Use hooks like `useQuery`, `useMutation` from `@tanstack/react-query`
7. **Lazy loading:** New pages should use React.lazy() with Suspense
8. **E2E for features:** Add Playwright tests for user-facing functionality

### Common Tasks

**Add a new page:**
1. Create in `src/app/pages/`
2. Add route in `src/app/routes.ts` with lazy loading
3. Add API hooks if needed in `src/app/hooks/`
4. Add E2E test in `e2e/`

**Add a new API endpoint:**
1. Define types in `src/app/types/api/`
2. Create endpoint function in `src/app/lib/api/endpoints/`
3. Use in hook or directly with TanStack Query

**Modify styling:**
1. Use Tailwind classes
2. Check `default_shadcn_theme.css` for design tokens
3. Use `@figma/astraui` components when available

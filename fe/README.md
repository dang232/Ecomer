# VNShop Web (frontend)

React 19.2.8 + Vite 7.3.6 + Tailwind v4 SPA. Talks to the backend through the Spring Cloud Gateway at `:8080`. Authenticates through the gateway's native httpOnly-cookie boundary; Keycloak stays internal to the service network.

## Quick start (local)

```bash
cp .env.example .env.local
# edit .env.local if your gateway runs somewhere else
pnpm install
pnpm run dev
```

App runs at http://localhost:5173 (Vite default). Sign in through the gateway's
native form; Keycloak is not a browser configuration surface.

## Scripts

- `pnpm run dev` — Vite dev server with HMR.
- `pnpm run build` — type-check then production build to `dist/`.
- `pnpm run typecheck` — TypeScript only, no emit.
- `pnpm run preview` — serve the built `dist/` for a smoke test.

## Layout

```
src/
├── main.tsx                  # QueryClientProvider > AuthProvider > <App/>
└── app/
    ├── App.tsx               # ErrorBoundary > VNShopProvider > Router
    ├── routes.ts             # role-gated routes (RequireAuth, RequireRole)
    ├── pages/                # one file per top-level page
    ├── components/           # ui + domain components (incl. error boundary)
    ├── hooks/
    │   ├── use-auth.tsx      # native cookie-auth wrapper
    │   ├── use-cart.ts       # TanStack Query around /cart
    │   ├── use-orders.ts
    │   └── use-wishlist.ts   # localStorage (until BE-8 ships)
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts     # fetch wrapper, ApiResponse<T> decode, idempotency
    │   │   ├── envelope.ts   # Zod schema + ApiError class
    │   │   └── endpoints/    # one file per backend domain
    │   ├── auth/
    │   │   ├── native-auth.ts # gateway login/refresh/logout boundary
    │   │   └── role-guard.tsx
    │   └── query-client.ts
    └── types/api.ts          # shared DTO schemas
```

## Backend contract

- Gateway base URL: `VITE_API_URL` (default `http://localhost:8080`).
- All responses are `ApiResponse<T> = { success, message, data, errorCode, timestamp }` — decoded once in `lib/api/client.ts`.
- `POST /orders` requires an `Idempotency-Key` header. The checkout flow generates one UUID per attempt and reuses it across retries.
- Cart is keyed off the JWT — gateway derives `x-user-id` from the bearer token, so the FE never sets it.
- `X-Correlation-Id` is generated per request and surfaced on `ApiError.correlationId` so the support flow can pull traces from Jaeger (`http://localhost:16686`).

## Open backend prerequisites

Tracked in the project plan as BE-1…BE-10. Most relevant for FE work:

- Variants (`F23`) — `ProductPage` ships a color/size selector that's currently UI-only.
- Guest cart (`F35`) — anonymous users can browse but can't add to cart yet.
- Wishlist API (`F36`) — `WishlistPage` is local-only via `localStorage` until `/users/me/wishlist` ships.
- Carrier tracking (`/shipping/track/*`) — order detail surfaces `subOrders[*].trackingCode` only.
- Push/SSE channel — notifications poll every 30s (Page Visibility-gated) until a stream endpoint exists.
- Keycloak remains internal to the service network. The gateway exposes only
  selected protocol resources for optional broker/reset flows; the admin console
  and direct container port are not exposed.

## Docker

```bash
docker compose --profile apps up -d frontend
# served by nginx on :3000 — visit http://localhost:3000
```

`Vite inlines VITE_*` at build time. Compose passes them through `args` in the `frontend` service block; override per environment when building production images.

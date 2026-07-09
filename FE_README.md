# VNShop Web (frontend)

React 18 + Vite 6 + Tailwind v4 SPA. Talks to the backend through the Spring Cloud Gateway at `:8080`. Authenticates against Keycloak (`vnshop` realm) using `keycloak-js` PKCE.

## Quick start (local)

```bash
cp .env.example .env.local
# edit .env.local if your gateway/Keycloak run somewhere else
npm install
npm run dev
```

App runs at http://localhost:5173 (Vite default). Sign in via the Keycloak redirect.

## Scripts

- `npm run dev` — Vite dev server with HMR.
- `npm run build` — type-check then production build to `dist/`.
- `npm run typecheck` — TypeScript only, no emit.
- `npm run preview` — serve the built `dist/` for a smoke test.

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
    │   ├── use-auth.tsx      # keycloak-js wrapper
    │   ├── use-cart.ts       # TanStack Query around /cart
    │   ├── use-orders.ts
    │   └── use-wishlist.ts   # localStorage (until BE-8 ships)
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts     # fetch wrapper, ApiResponse<T> decode, idempotency
    │   │   ├── envelope.ts   # Zod schema + ApiError class
    │   │   └── endpoints/    # one file per backend domain
    │   ├── auth/
    │   │   ├── keycloak.ts   # singleton Keycloak instance
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
- Keycloak client `vnshop-web` (PKCE, redirect `http://localhost:3000/*` and `http://localhost:5173/*`) needs to be present in the realm import.

## Docker

```bash
docker compose --profile apps up -d frontend
# served by nginx on :3000 — visit http://localhost:3000
```

`Vite inlines VITE_*` at build time. Compose passes them through `args` in the `frontend` service block; override per environment when building production images.

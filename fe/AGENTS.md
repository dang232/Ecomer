# Frontend (fe/)

**Stack:** React 18, Vite 6, TypeScript strict, Tailwind 4, React Router 7

## STRUCTURE
```
fe/src/
├── app/                   # Router, pages, components, hooks, types
│   ├── pages/            # Page components (lazy-loaded)
│   ├── components/       # Shared UI components
│   ├── hooks/           # Custom hooks (use-orders, use-products, etc.)
│   ├── lib/             # Auth, API clients, i18n, query-client
│   └── types/           # API type definitions
├── features/             # Feature modules (videos/)
├── imports/             # Type-only imports (auto-generated)
├── utils/               # Utility functions
└── main.tsx             # Entry point
```

## KEY PATTERNS
- **Routing**: React Router 7, lazy-loaded pages with Suspense + ErrorBoundary
- **State**: Zustand for global state, React Query for server state
- **API**: Fetch-based clients in `app/lib/api/`, typed with generated types
- **Auth**: Keycloak ROPC flow, tokens stored in memory (not localStorage)
- **Styling**: Tailwind + Figma Astra UI library, CSS custom properties
- **Forms**: React Hook Form + Zod validation

## COMMANDS
```bash
cd fe
npm run dev          # Dev server (port 3000)
npm run build       # Production build
npm test            # Vitest unit tests
npm run test:e2e    # Playwright E2E tests
npm run verify      # Full: typecheck + lint + test + build
```

## TEST SETUP
- Vitest with `happy-dom`, React Testing Library, `@testing-library/jest-dom`
- Playwright for E2E, axe-core for accessibility testing
- Test files: `*.test.{ts,tsx}` co-located with source

## ESLINT RULES (strict)
- `no-explicit-any: error` - No `any` types
- `consistent-type-imports` - Use `import type` for types
- `no-unsafe-*` - Strict null/typed checks
- Test files excluded from strict rules

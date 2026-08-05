# Web Commerce Modernization Baseline

- Baseline source commit: `cd6e792f7cb9d332f8f37a443e3aaacbc472cef4`
- Package manager: pnpm 9.15.9
- Runtime: React 19.2.8, Vite 7.3.6
- Typecheck: app, tests, E2E, and Node configuration pass
- ESLint: repository-wide `pnpm run lint` reports 563 errors and 170 warnings; `pnpm run lint:changed -- --base cd6e792f` passes for the changed frontend TypeScript files
- Unit tests: 96 test files and 646 tests pass
- Bundle measurement tests: 3 pass
- Production build: pass
- Bundle evidence: `fe/performance/baseline/route-bundles.json`
- Lighthouse evidence: `fe/performance/baseline/lighthouse-mobile.json`
- Buyer proxies: home-to-search completion in 3 actions and checkout redirect preservation pass

## Mobile Lighthouse Medians

| Route | Median LCP | Median CLS |
| --- | ---: | ---: |
| Home | 1855.08 ms | 0.001711 |
| Search | 1312.46 ms | 0.089006 |
| Product | 2082.57 ms | 0.000298 |
| Cart | 1300.87 ms | 0.001711 |
| Checkout | 1399.29 ms | 0.000111 |

## Route Bundle Gzip Sizes

| Route | Gzip size |
| --- | ---: |
| Home | 300187 bytes |
| Search | 303521 bytes |
| Product | 324165 bytes |
| Cart | 299079 bytes |
| Checkout | 318944 bytes |

## Known Baseline Defects

- Repository-wide ESLint currently reports 563 errors and 170 warnings in existing frontend source, test, and E2E files outside this baseline change.
- The production build reports a 772.25 kB JavaScript chunk, above the configured 600 kB warning threshold.
- The home and checkout Lighthouse samples contain individual high-CLS outliers (0.505278 and 0.175368 respectively); the recorded medians remain low and are retained unchanged in the raw evidence.

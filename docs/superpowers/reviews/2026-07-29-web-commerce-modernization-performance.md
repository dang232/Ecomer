# Performance Budget Review — VNShop Commerce Modernization

> **Plan 07, Task 3: Enforce Bundle And Lighthouse Budgets**

## Performance Budget Constraints

| Metric | Budget | Source |
|--------|--------|--------|
| Key-route gzip JavaScript growth | ≤ 10% from baseline | Master plan |
| Median LCP (mobile) | ≤ 2,500 ms | Master plan |
| Median CLS (mobile) | < 0.1 | Master plan |
| Lighthouse configuration | Mobile 390x844, CPU slowdown 4x, 3 runs per route | Plan 01 |

## Routes Under Budget

| Route | Baseline gzip (bytes) | Current gzip (bytes) | Growth (%) | Budget |
|-------|----------------------|----------------------|-----------|--------|
| home | 300,187 | 316,567 | 5.5% | PASS |
| search | 303,521 | 319,237 | 5.2% | PASS |
| product | 324,165 | 340,410 | 5.0% | PASS |
| cart | 299,079 | 318,615 | 6.5% | PASS |
| checkout | 318,944 | 336,071 | 5.4% | PASS |

Baseline source: `fe/performance/baseline/route-bundles.json`. Current source:
fresh `fe/performance/current/route-bundles.json` generated after a production
build of candidate source commit `3373776d`.

## Lighthouse Mobile Metrics

Fresh Lighthouse measurement is blocked while Docker-backed frontend and
seeded services are unavailable. The existing `current/lighthouse-mobile.json`
is not treated as fresh evidence because it predates the current production
build.

| Route | Median LCP (ms) | Median CLS | LCP Budget | CLS Budget |
|-------|-----------------|------------|------------|------------|
| home | [pending] | [pending] | ≤ 2,500 | < 0.1 |
| search | [pending] | [pending] | ≤ 2,500 | < 0.1 |
| product | [pending] | [pending] | ≤ 2,500 | < 0.1 |
| cart | [pending] | [pending] | ≤ 2,500 | < 0.1 |
| checkout | [pending] | [pending] | ≤ 2,500 | < 0.1 |

Baseline source: `fe/performance/baseline/lighthouse-mobile.json`

## Measurement Infrastructure

### Scripts

- `fe/scripts/measure-route-bundles.mjs` — reads Vite manifest from `dist/.vite/manifest.json`, computes gzip bytes per route and asset sha256
- `fe/scripts/measure-lighthouse.mjs` — runs 3 Lighthouse runs per route against production build, captures LCP and CLS medians
- `fe/scripts/compare-performance.mjs` — compares baseline vs current measurements, fails on budget violations

### Verification Commands

```powershell
# Measure and compare (requires production build + seeded services)
pnpm run measure:performance    # build + measure:bundles + measure:lighthouse
pnpm run verify:performance     # compare-performance.mjs

# Or step-by-step
pnpm run build
pnpm run measure:bundles -- --output performance/current/route-bundles.json
pnpm run measure:lighthouse -- --output performance/current/lighthouse-mobile.json
pnpm run verify:performance
```

## Evidence Establishment

The bundle artifact is current. To establish the remaining truthful Lighthouse
evidence:

1. Start seeded services: `docker compose --profile apps up -d --build`
2. Build production frontend: `cd fe && pnpm run build`
3. Run Lighthouse measurement (requires Chrome):
   ```powershell
   pnpm run measure:lighthouse -- --output performance/current/lighthouse-mobile.json
   ```
4. Copy bundle measurement:
   ```powershell
   pnpm run measure:bundles -- --output performance/current/route-bundles.json
   ```
5. Verify within budget:
   ```powershell
   pnpm run verify:performance
   ```

## Budget Verification Test Results

Test suite: `fe/scripts/compare-performance.test.mjs`

| Test | Status |
|------|--------|
| Fails route above 10% gzip growth | PASS |
| Fails Lighthouse medians outside targets | PASS |
| Fails on missing routes / malformed runs / wrong config | PASS |
| Rejects relabeled URLs / duplicate routes / altered throttling | PASS |
| Rejects missing or extra bundle route labels | PASS |
| Passes valid measurements within budget | PASS |

## Review Gate Status

- [x] Performance measurement scripts implemented and tested
- [x] `compare-performance.test.mjs` — all 6 tests pass
- [x] Baseline evidence recorded (`fe/performance/baseline/`)
- [x] Current route bundle evidence captured via `measure:bundles`
- [x] All routes within 10% gzip budget
- [ ] All routes meet LCP ≤ 2,500ms target
- [ ] All routes meet CLS < 0.1 threshold
- [ ] Fresh Lighthouse configuration and three-run evidence verified (mobile 390x844, 4x CPU slowdown, 3 runs)
- [x] Performance review documented with the Docker/Lighthouse blocker

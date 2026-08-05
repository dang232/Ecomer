# VNShop Commerce Modernization Integrated Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate, independently review, verify, cut over, and promote the complete buyer, seller, and admin modernization as one production generation.

**Architecture:** Production-build Playwright suites validate persona workflows and responsive states against deterministic seeded services. Automated boundary, type, accessibility, visual, bundle, and Lighthouse gates block cutover; the final cleanup removes the development preview and every compatibility implementation before the existing immutable staging-to-production workflow promotes the reviewed artifact.

**Tech Stack:** pnpm 9.15.9, TypeScript, ESLint, Vitest, Playwright, Axe, Lighthouse, Vite manifest, Docker, GitHub Actions, Argo CD release locks.

## Global Constraints

- Do not expose mixed current/modernized production screens.
- Run browser journeys against the production Vite build, not the dev server.
- Use `infra/scripts/seed-demo.mjs` only to ensure catalog prerequisites. Persona
  journeys create uniquely named records per run and select those records by
  captured IDs; visual and state snapshots use typed route interception fixtures
  so prior carts, orders, payouts, and queue rows cannot affect expected output.
- Require zero type errors, zero unsafe-boundary findings, zero dependency-boundary findings, and zero ESLint errors.
- Require no Critical Axe violations and no unresolved Critical or Important code-review findings.
- Require no horizontal page overflow, clipped primary action, sticky overlap, unstable product tile, or oversized footer in the representative viewport matrix.
- Require key-route gzip JavaScript to remain within 10% of the recorded baseline unless an independently reviewed report explains and mitigates the increase.
- Require median LCP at or below 2.5 seconds and CLS below 0.1 across three mobile Lighthouse runs for home, search, product, cart, and checkout.
- Remove `?__commercePreview`, old-generation branches, deprecated UI re-exports, and superseded route wrappers before cutover.
- Preserve the repository's protected staging promotion, production pull request, production verification, and immutable rollback workflows.
- Run the master plan Review Gate after every task.
- Do not stage or commit `fe/.ua/`.

---

### Task 1: Build Complete Production Persona Journeys

**Files:**
- Create: `fe/e2e/_credentials.ts`
- Modify: `fe/e2e/_auth.ts`
- Modify: `fe/e2e/_workday-evidence.ts`
- Modify: `fe/e2e/a11y.spec.ts`
- Modify: `fe/e2e/admin-coupon-crud-ui.spec.ts`
- Modify: `fe/e2e/admin-ui.spec.ts`
- Modify: `fe/e2e/authenticated-routes.spec.ts`
- Modify: `fe/e2e/auth-proxy-boundary.spec.ts`
- Modify: `fe/e2e/dashboard-charts-ui.spec.ts`
- Modify: `fe/e2e/day-simulation.spec.ts`
- Modify: `fe/e2e/full-ui-audit.spec.ts`
- Modify: `fe/e2e/journey/01-admin-onboards-the-marketplace.spec.ts`
- Modify: `fe/e2e/journey/03-seller-fulfills-the-order.spec.ts`
- Modify: `fe/e2e/journey/05-seller-cashes-out.spec.ts`
- Modify: `fe/e2e/journey/06-admin-closes-the-loop.spec.ts`
- Modify: `fe/e2e/network-diagnostic.spec.ts`
- Modify: `fe/e2e/role-routes.spec.ts`
- Modify: `fe/e2e/seller-dashboard-ui.spec.ts`
- Modify: `fe/e2e/seller-orders-ui.spec.ts`
- Modify: `fe/e2e/seller-products-ui.spec.ts`
- Modify: `fe/e2e/seller-wallet-ui.spec.ts`
- Modify: `fe/e2e/ux-sweep.spec.ts`
- Modify: `fe/e2e/video-integration-ui.spec.ts`
- Modify: `fe/e2e/workday-admin.spec.ts`
- Modify: `fe/e2e/workday-seller.spec.ts`
- Create: `fe/e2e/modernization/_fixtures.ts`
- Create: `fe/e2e/modernization/buyer.spec.ts`
- Create: `fe/e2e/modernization/seller.spec.ts`
- Create: `fe/e2e/modernization/admin.spec.ts`
- Create: `fe/e2e/modernization/cross-persona.spec.ts`
- Modify: `fe/e2e/sellers-public-ui.spec.ts`
- Modify: `fe/e2e/ux-sweep.spec.ts`
- Modify: `fe/e2e/workday-seller.spec.ts`
- Modify: `fe/e2e/search-filters-ui.spec.ts`
- Modify: `fe/playwright.config.ts`
- Modify: `fe/package.json`
- Create: `fe/scripts/assert-playwright-results.mjs`
- Test: `fe/scripts/assert-playwright-results.test.mjs`
- Create: `fe/scripts/check-e2e-credentials.mjs`
- Test: `fe/scripts/check-e2e-credentials.test.mjs`
- Test: `fe/e2e/modernization/buyer.spec.ts`
- Test: `fe/e2e/modernization/seller.spec.ts`
- Test: `fe/e2e/modernization/admin.spec.ts`
- Test: `fe/e2e/modernization/cross-persona.spec.ts`

**Interfaces:**
- Consumes: seeded backend, `_auth.ts`, current endpoint helpers, modernized routes, and production frontend at `http://localhost:3000`.
- Produces: `test:e2e:modernization`, typed persona fixtures, request-count evidence, and cross-persona continuity.

- [ ] **Step 1: Define deterministic typed fixtures**

Create `_fixtures.ts`:

```ts
import { expect, test as base, type Page } from "@playwright/test";

import { loginAsPersona } from "../_auth";

type PersonaFixtures = {
  loginBuyer: () => Promise<void>;
  loginSeller: () => Promise<void>;
  loginAdmin: () => Promise<void>;
};

export const test = base.extend<PersonaFixtures>({
  loginBuyer: async ({ page }, use) =>
    use(() => loginAsPersona(page, "buyer")),
  loginSeller: async ({ page }, use) =>
    use(() => loginAsPersona(page, "seller")),
  loginAdmin: async ({ page }, use) =>
    use(() => loginAsPersona(page, "admin")),
});

export { expect };

export async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}
```

First create `_credentials.ts` as the one source of seeded persona credentials.
It exports a `buyer | seller | admin` discriminated persona type and
`credentialForPersona(persona)`. Read `E2E_BUYER_*`, `E2E_SELLER_*`, and
`E2E_ADMIN_*`, with `buyer1`/`seller1`/`admin1` and `test` fallbacks only when
`E2E_RELEASE_CONTRACT` is not `true`. `E2E_REQUIRED_PERSONAS` is a required
comma-separated list for protected runs: the complete external gate sets
`buyer,seller,admin`, while the standalone `@staging-contract` release test
sets `buyer` because it intentionally has no seller/admin journeys. Credential
validation fails before collection for every requested persona, not for
unselected personas. `_auth.ts` requires an explicit password for dynamically
created users and adds `loginAsPersona(page, persona)` for seeded users; it must
have no default password. `_workday-evidence.ts` accepts a persona rather than
a literal seeded username.

Replace every current seeded-account login listed in this task, including
direct `/auth/login` request payloads, with `credentialForPersona` or
`loginAsPersona`. Per-test users created with unique credentials remain
unchanged. Add `check-e2e-credentials.mjs` using the TypeScript AST to reject
seeded aliases/emails or `"test"` passwords in OIDC helpers, form fills, and
`/auth/login` payloads outside `_credentials.ts`; its fixture covers helper
calls and direct request bodies. Add the check to `verify:e2e` so the complete
external suite cannot silently bypass rotated protected credentials.

- [ ] **Step 2: Implement buyer journey coverage**

`buyer.spec.ts` covers:

```ts
test("buyer discovers, selects, carts, checks out, and opens the order", async ({
  page,
  loginBuyer,
}) => {
  await loginBuyer();
  await page.goto("/");
  await page.getByRole("searchbox").fill("phone");
  await page.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/\/search\?.*q=phone/);
  await page.getByRole("link", { name: /phone/i }).first().click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: /cart/i })).toBeVisible();
  await page.getByRole("button", { name: /checkout/i }).click();
  await expect(page).toHaveURL("/checkout");
});
```

Add separate tests for search URL restoration, wishlist, COD checkout, online
payment initialization failure/retry, successful VNPay and MoMo return
recovery, orders/detail, return request/status, profile/address,
notifications/preferences, messages, and seller detail. The return tests seed a
valid recovery record, supply the provider reference, and prove status polling
uses the recovered order ID. For payment retry, count `POST /orders` and
payment-create requests:

```ts
let orderRequests = 0;
page.on("request", (request) => {
  if (request.method() === "POST" && new URL(request.url()).pathname === "/orders") {
    orderRequests += 1;
  }
});
expect(orderRequests).toBe(1);
```

- [ ] **Step 3: Implement seller journey coverage**

`seller.spec.ts` logs in as seller1 and verifies:

- dashboard day range and partial KPI behavior;
- product search, create, edit, media, publish, deep-linked editor, and unsaved close;
- pending order search, detail, accept, reject confirmation without a reason
  body or textbox, carrier/tracking validation, and ship;
- review search and pagination without unsupported filters/actions;
- wallet filter, invalid payout amount, stable retry key, and history;
- read-only settings without raw JSON or unsupported Save.

Use route URLs (`/seller/products`, `/seller/orders`, and so on), not old tab labels as navigation state.

- [ ] **Step 4: Implement admin journey coverage**

`admin.spec.ts` logs in as admin1 and verifies:

- date-controlled dashboard and export;
- order search/status/page/detail/refund/status change;
- coupon create, inspect, and deactivate, with edit controls absent for
  existing coupons;
- seller approval/rejection reason;
- review approval/rejection reason;
- video queue/page/preview and appeal decision;
- dispute resolution;
- payout completion evidence and failure reason;
- user search/page/order history/ban/unban;
- health refresh and unavailable service rendering.

Assert unsupported sort, bulk-select, and pagination controls are absent from queues whose capability map disables them.

- [ ] **Step 5: Implement cross-persona continuity**

`cross-persona.spec.ts` follows the existing journey state discipline:

1. Admin approves a seller and creates a coupon.
2. Buyer uses the coupon and creates one order.
3. Seller accepts and ships the order.
4. Buyer opens the order/review context.
5. Seller requests a payout.
6. Admin completes the payout with evidence.

Use API setup only for preconditions that the UI cannot create deterministically.
Generate a `runId` once per test, include it in seller product names and other
searchable records, and capture every returned entity ID used by later steps.
At buyer setup, read the authenticated cart and remove every existing item
through the public cart endpoints before adding the test product. Do not assert
global queue counts or first-row identity. Every modernized UI action under
acceptance remains a browser action.

Replace the direct `http://localhost:8080` request in
`search-filters-ui.spec.ts` with
`process.env.VITE_E2E_API_URL ?? "http://localhost:8080"`. Audit every E2E
`APIRequestContext` call: local URLs may exist only as environment fallbacks,
and `run-cutover-gate.ps1` external mode must set
`VITE_E2E_API_URL` from the same trusted public API origin paired with its
`ExternalBaseUrl`; it must never use a reserved `.invalid` placeholder.

- [ ] **Step 6: Add scripts and machine-readable results**

Add JSON to the Playwright reporters:

```ts
reporter: [
  ["list"],
  ["html", { open: "never" }],
  [
    "json",
    {
      outputFile:
        process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ??
        "test-results/playwright-results.json",
    },
  ],
],
```

Add:

```json
{
  "scripts": {
    "test:e2e:modernization": "playwright test e2e/modernization --project=chromium",
    "test:e2e:local-complete": "playwright test --grep-invert @staging-contract",
    "test:e2e:assert-results": "node scripts/assert-playwright-results.mjs",
    "lint:e2e-credentials": "node scripts/check-e2e-credentials.mjs",
    "verify:e2e": "pnpm run lint:e2e-credentials && pnpm run typecheck:e2e"
  }
}
```

Create `assert-playwright-results.mjs` with Zod schemas for the Playwright JSON
report. Recursively inspect suites/specs/tests and fail when the selected run
contains zero tests, any skipped/interrupted/unexpected/failing outcome, or a
duplicate title in one project. Export the pure validator and test valid,
empty, skipped, malformed, and failed reports.

The staging TLS release contract is tagged `@staging-contract` in Task 4 and is
excluded from the local complete selection, not selected and skipped. The
protected promotion workflow runs it separately with trusted TLS and staging
credentials. No data-dependent seller, product, admin, or modernization skip
is permitted; those `test.skip()` branches become deterministic fixture setup
or explicit failures.

- [ ] **Step 7: Run production persona journeys**

Run from repository root:

```powershell
docker compose --profile apps up -d --build
node infra/scripts/seed-demo.mjs
```

Run from `fe`:

```powershell
$env:VITE_E2E_BASE_URL = "http://localhost:3000"
$env:E2E_SKIP_WEBSERVER = "true"
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = "test-results/modernization-results.json"
pnpm run verify:e2e
pnpm run test:e2e:modernization
pnpm run test:e2e:assert-results -- test-results/modernization-results.json
```

Expected: all buyer, seller, admin, and cross-persona tests pass with one
worker, JSON results are written, and zero scenarios are skipped.

- [ ] **Step 8: Review and commit**

Use the master Review Gate, inspect retained traces for every retry, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "test(fe): cover modernized commerce journeys"
```

### Task 2: Enforce Responsive, Accessibility, And Localization Acceptance

**Files:**
- Create: `fe/e2e/modernization/_acceptance-auth.ts`
- Create: `fe/e2e/modernization/_state-drivers.ts`
- Create: `fe/e2e/modernization/visual-matrix.spec.ts`
- Create: `fe/e2e/modernization/state-matrix.spec.ts`
- Create: `fe/e2e/modernization/accessibility.spec.ts`
- Create: `fe/e2e/modernization/text-scale.spec.ts`
- Create: `fe/e2e/modernization/visual-matrix.spec.ts-snapshots` (Playwright-managed PNG snapshot directory)
- Modify: `fe/e2e/a11y.spec.ts`
- Modify: `fe/playwright.config.ts`
- Create: `fe/scripts/local-origin-proxy.mjs`
- Create: `fe/scripts/local-origin-proxy.test.mjs`
- Create: `fe/scripts/run-visual-linux.ps1`
- Modify: `fe/package.json`
- Create: `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-visual-review.md`

**Interfaces:**
- Consumes: `COMMERCE_ACCEPTANCE`, representative viewports, production persona fixtures, and Axe.
- Produces: reviewed screenshot snapshots, exhaustive declared-state evidence, zero-critical Axe gate, 200% text verification, and overlap assertions.

- [ ] **Step 1: Write the visual matrix with structural assertions**

Create `_acceptance-auth.ts` so visual, Axe, and text-scale suites use the same typed persona policy:

```ts
import type { Page } from "@playwright/test";

import { loginAsPersona } from "../_auth";

export type AcceptancePersona = "public" | "buyer" | "seller" | "admin";

export async function authenticateForPersona(
  page: Page,
  persona: AcceptancePersona,
): Promise<void> {
  if (persona !== "public") {
    await loginAsPersona(page, persona);
  }
}

export async function authenticateForPath(page: Page, path: string): Promise<void> {
  if (path.startsWith("/seller")) return authenticateForPersona(page, "seller");
  if (path.startsWith("/admin")) return authenticateForPersona(page, "admin");
  if (/^\/(cart|checkout|orders)(\/|$)/.test(path)) {
    return authenticateForPersona(page, "buyer");
  }
}
```

When `E2E_RUNTIME_CONFIG_OVERRIDE=true`, install one route before any public or
authenticated navigation that fetches the real `/runtime-config.json`, decodes
it with the shared E2E Zod schema, and rewrites only API/auth origins to the
wrapper-provided `VITE_E2E_API_URL`/`VITE_E2E_AUTH_URL`. The pinned Linux visual
wrapper enables this only for its local loopback proxies; trusted staging uses
the real deployed runtime config.

Create `visual-matrix.spec.ts`:

```ts
import type { Locator } from "@playwright/test";

import {
  ACCEPTANCE_VIEWPORTS,
  COMMERCE_ACCEPTANCE,
  resolveAcceptancePath,
} from "../fixtures/commerce-acceptance";
import { authenticateForPersona } from "./_acceptance-auth";
import { expect, expectNoPageOverflow, test } from "./_fixtures";
import { acceptanceReadyDriver } from "./_state-drivers";

const sanitize = (path: string) =>
  path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "home";

for (const route of COMMERCE_ACCEPTANCE) {
  for (const viewportName of route.viewports) {
    test(`${route.persona} ${route.path} at ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(ACCEPTANCE_VIEWPORTS[viewportName]);
      await authenticateForPersona(page, route.persona);
      const path = await resolveAcceptancePath(page.request, route.path);
      const ready = acceptanceReadyDriver(route);
      await ready.prepare(page, path);
      await page.goto(path);
      await ready.trigger?.(page);
      await ready.assert(page);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await expect
        .poll(() =>
          page.locator("main img").evaluateAll((images) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
        )
        .toBe(true);
      await expectNoPageOverflow(page);
      await expect(page).toHaveScreenshot(
        `${route.persona}-${sanitize(route.path)}-${viewportName}.png`,
        { fullPage: true, animations: "disabled" },
      );
    });
  }
}
```

The typed ready-state driver intercepts route-critical API calls with
Zod-validated, immutable payloads before navigation and its `assert` waits for
the route's primary content while proving its loading status/skeleton is gone.
Screenshots therefore depend on an executable route contract, not mutable
persona data or a convention that route components may forget to implement.

Add this element-box helper and use it for the mobile bottom nav, product purchase bar, and the last main-content action:

```ts
async function expectNoIntersection(first: Locator, second: Locator): Promise<void> {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  if (!a || !b) return;
  const intersects =
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
  expect(intersects).toBe(false);
}
```

- [ ] **Step 2: Exercise every declared route state**

Create `_state-drivers.ts` with a typed driver registry:

```ts
import type { Page } from "@playwright/test";

import type { AcceptanceRoute } from "../fixtures/commerce-acceptance";

export type AcceptanceState = AcceptanceRoute["states"][number];
export type StateKey = `${AcceptanceRoute["path"]}::${AcceptanceState}`;

export interface StateDriver {
  authenticate?: (page: Page) => Promise<void>;
  prepare: (page: Page, resolvedPath: string) => Promise<void>;
  trigger?: (page: Page) => Promise<void>;
  assert: (page: Page) => Promise<void>;
}

export const stateDrivers: Partial<Record<StateKey, StateDriver>> = {
  // Every route/state pair in COMMERCE_ACCEPTANCE is implemented explicitly.
};

export function missingStateDrivers(
  acceptance: readonly AcceptanceRoute[],
): StateKey[] {
  return acceptance.flatMap((route) =>
    route.states
      .map((state) => `${route.path}::${state}` as const)
      .filter((key) => stateDrivers[key] === undefined),
  );
}

export function acceptanceReadyDriver(route: AcceptanceRoute): StateDriver {
  const key: StateKey = `${route.path}::ready`;
  const driver = stateDrivers[key];
  if (!driver) throw new Error(`Missing ready-state driver for ${route.path}`);
  return driver;
}
```

Implement every registry entry; do not leave the object shown above empty.
Use production routes and Playwright interception, never a production
test-only query parameter:

| State | Driver behavior |
|---|---|
| `loading` | Delay the route's primary read and assert its localized `role="status"` or skeleton before releasing it. |
| `empty` | Fulfill the primary read with a schema-valid empty envelope and assert the localized empty heading/action. |
| `partial` | Let the primary dashboard/home read succeed, fail one secondary read with 503, and assert usable primary content plus an inline warning. |
| `error` | Fulfill the primary read with 503 and assert a localized `role="alert"` plus retry action. |
| `ready` | Fulfill every route-critical read from an immutable, schema-validated fixture; assert the route's primary content is visible and its loading status/skeleton is absent. |
| `pending` | Start the route's real mutation, hold that request, and assert the initiating action is disabled and labeled busy before aborting it. |
| `success` | Exercise the route's real supported success transition. Checkout clears the current buyer's cart, uses a fresh key, and completes COD; payment return seeds a valid recovery record/reference and completes status polling with the recovered order ID; forms and queues submit their exact typed mutation. |

Map every primary read and mutation in `COMMERCE_ACCEPTANCE` to its existing
typed endpoint, including buyer account/returns/wishlist/messages/notifications,
every seller product/order/review/wallet/settings route, and every admin
dashboard/queue/system route. Import canonical input/output schemas when
building fulfill bodies so fixture drift fails typecheck or schema parsing.
The payment-return ready driver seeds a pending recovery record before
navigation; its success driver table-tests both VNPay and MoMo even though the
route inventory uses VNPay as the canonical route-pattern representative.

Create `state-matrix.spec.ts`:

```ts
import { MODERNIZED_COMMERCE_ROUTE_PATHS } from "@/app/commerce-route-inventory";

import {
  COMMERCE_ACCEPTANCE,
  resolveAcceptancePath,
} from "../fixtures/commerce-acceptance";
import { authenticateForPersona } from "./_acceptance-auth";
import { expect, test } from "./_fixtures";
import {
  missingStateDrivers,
  stateDrivers,
  type StateKey,
} from "./_state-drivers";

test("state driver registry covers the acceptance contract", () => {
  expect(missingStateDrivers(COMMERCE_ACCEPTANCE)).toEqual([]);
});

test("acceptance matrix covers every modernized commerce route", () => {
  expect(COMMERCE_ACCEPTANCE.map((route) => route.path).sort()).toEqual(
    [...MODERNIZED_COMMERCE_ROUTE_PATHS].sort(),
  );
});

for (const route of COMMERCE_ACCEPTANCE) {
  for (const state of route.states) {
    test(`${route.path} exposes ${state}`, async ({ page }) => {
      const key: StateKey = `${route.path}::${state}`;
      const driver = stateDrivers[key];
      expect(driver, `missing ${route.path} ${state} driver`).toBeDefined();
      if (!driver) return;
      if (driver.authenticate) {
        await driver.authenticate(page);
      } else {
        await authenticateForPersona(page, route.persona);
      }
      const path = await resolveAcceptancePath(page.request, route.path);
      await driver.prepare(page, path);
      await page.goto(path);
      await driver.trigger?.(page);
      await driver.assert(page);
    });
  }
}
```

- [ ] **Step 3: Add critical route Axe checks**

Create `accessibility.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";

import {
  COMMERCE_ACCEPTANCE,
  resolveAcceptancePath,
} from "../fixtures/commerce-acceptance";
import { authenticateForPersona } from "./_acceptance-auth";
import { expect, test } from "./_fixtures";
import { acceptanceReadyDriver } from "./_state-drivers";

const AXE_ROUTES = new Set([
  "/",
  "/search?q=phone",
  "/cart",
  "/checkout",
  "/seller/orders",
  "/admin/orders",
]);

for (const route of COMMERCE_ACCEPTANCE.filter((candidate) => AXE_ROUTES.has(candidate.path))) {
  test(`has no critical Axe violations at ${route.path}`, async ({ page }) => {
    await authenticateForPersona(page, route.persona);
    const path = await resolveAcceptancePath(page.request, route.path);
    const ready = acceptanceReadyDriver(route);
    await ready.prepare(page, path);
    await page.goto(path);
    await ready.trigger?.(page);
    await ready.assert(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
  });
}
```

Add keyboard-only tests for header search, mobile navigation, filters/drawers, product variants, checkout steps, seller editor, admin queue drawer, and decision dialogs. Assert focus returns to the opener after drawer/dialog close.

- [ ] **Step 4: Add 200% text and language expansion checks**

Create `text-scale.spec.ts`:

```ts
import { expectNoPageOverflow, test } from "./_fixtures";

test("critical actions remain visible at 200 percent text scale", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/search?q=phone");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expectNoPageOverflow(page);
  await expect(page.getByRole("button", { name: /filter/i })).toBeVisible();
});
```

Repeat for product, cart, checkout, seller products, and admin orders. Switch between Vietnamese and English and assert the document `lang` attribute updates and primary actions remain inside their bounding boxes.

- [ ] **Step 5: Generate and review authoritative Linux snapshots**

Set an explicit platform-aware path in `playwright.config.ts`:

```ts
snapshotPathTemplate:
  "{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}",
```

Create `run-visual-linux.ps1` as the only snapshot update/compare entry point.
It resolves and pins by digest the official Playwright 1.60 Linux image, mounts
the exact frontend source read/write only for update mode, installs with the
frozen pnpm lock, forwards base/API/auth origins and protected persona
credentials, and adds the reviewed host/CA mappings required by local Compose
or staging TLS. The script rejects any non-Linux container platform and any
unpinned image reference.

For local generation, browser-visible URLs must remain
`http://localhost:3000` and `http://localhost:8080`, which satisfy the
frontend insecure-runtime guard and the gateway's existing local CORS allowlist.
Keycloak is network-internal; the local auth origin is the gateway's
`http://localhost:8080`, matching the configured local issuer. The
`local-origin-proxy.mjs` runs inside the Playwright container and exposes the
frontend port plus the gateway port while forwarding HTTP and WebSocket traffic
upstream to `host.docker.internal`. Preserve `Host`, `Origin`, `Location`,
`Set-Cookie`, method, body, and response status semantics so OIDC redirects and
cookies stay on browser-visible localhost origins. Its test starts disposable
upstreams and proves browser-visible localhost routing, headers, redirects,
cookies, and upgrade forwarding before the wrapper uses it.

The acceptance runtime-config fixture rewrites only to those localhost proxy
origins before authentication and sets API and auth origin to the same gateway
URL; `host.docker.internal` is never emitted into browser-visible runtime config
or navigation. For promotion comparison, the wrapper uses trusted staging
HTTPS origins and the mounted CA without local proxies. Both paths execute the
same Playwright image and Chromium build.

Run update mode against the production Compose stack:

```powershell
& scripts/run-visual-linux.ps1 -Mode update `
  -BaseUrl http://localhost:3000 `
  -ApiUrl http://localhost:8080 `
  -AuthUrl http://localhost:8080
```

Only the resulting `*-linux.png` files are authoritative. Windows may view
them but must never run `--update-snapshots` outside this wrapper.

Review every new snapshot at its native viewport. Create `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-visual-review.md` listing each route/viewport, reviewer, outcome, and concrete finding resolution. Do not approve a route with overlap, clipped actions, horizontal overflow, unstable tiles, unreadable contrast, or a footer that dominates the viewport.

- [ ] **Step 6: Add release scripts**

Add:

```json
{
  "scripts": {
    "test:visual": "playwright test e2e/modernization/visual-matrix.spec.ts",
    "test:states": "playwright test e2e/modernization/state-matrix.spec.ts",
    "test:a11y": "playwright test e2e/a11y.spec.ts e2e/modernization/accessibility.spec.ts e2e/modernization/text-scale.spec.ts"
  }
}
```

- [ ] **Step 7: Verify, review, and commit**

Run comparison through the same pinned Linux wrapper, then the non-visual gates:

```powershell
node --test scripts/local-origin-proxy.test.mjs
& scripts/run-visual-linux.ps1 -Mode compare `
  -BaseUrl http://localhost:3000 `
  -ApiUrl http://localhost:8080 `
  -AuthUrl http://localhost:8080
pnpm run test:states
pnpm run test:a11y
pnpm run typecheck:e2e
```

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory, including each snapshot file.
Add-ReviewedTaskFiles -Paths $taskFiles
git add -f docs/superpowers/reviews/2026-07-29-web-commerce-modernization-visual-review.md
git commit -m "test(fe): enforce responsive commerce acceptance"
```

### Task 3: Enforce Bundle And Lighthouse Budgets

**Files:**
- Create: `fe/scripts/compare-performance.mjs`
- Create: `fe/scripts/compare-performance.test.mjs`
- Modify: `fe/scripts/measure-route-bundles.mjs`
- Modify: `fe/scripts/measure-lighthouse.mjs`
- Modify: `fe/package.json`
- Create: `fe/performance/current/route-bundles.json`
- Create: `fe/performance/current/lighthouse-mobile.json`
- Create: `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-performance.md`

**Interfaces:**
- Consumes: baseline route gzip and Lighthouse files from Plan 01.
- Produces: current measurements and a blocking `pnpm run verify:performance` comparison.

- [ ] **Step 1: Write failing budget comparison tests**

Create `compare-performance.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { comparePerformance } from "./compare-performance.mjs";

const validLighthouse = () => ({
  schemaVersion: 1,
  configuration: {
    viewport: "390x844",
    formFactor: "mobile",
    cpuSlowdown: 4,
    runsPerRoute: 3,
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      requestLatencyMs: 150,
      downloadThroughputKbps: 1638.4,
      uploadThroughputKbps: 750,
    },
  },
  routes: ["home", "search", "product", "cart", "checkout"].map((route) => ({
    route,
    url:
      route === "home" ? "/"
      : route === "search" ? "/search?q=phone"
      : route === "product" ? "/product/seeded-product"
      : `/${route}`,
    runs: Array.from({ length: 3 }, () => ({ lcpMs: 2_000, cls: 0.05 })),
    medianLcpMs: 2_000,
    medianCls: 0.05,
  })),
});
const validBundles = () => ({
  routes: Object.fromEntries(
    ["home", "search", "product", "cart", "checkout"].map((route) => [
      route,
      { gzipBytes: 100_000 },
    ]),
  ),
});

test("fails a route above ten percent gzip growth", () => {
  const current = validBundles();
  current.routes.home.gzipBytes = 111_000;
  const findings = comparePerformance(
    validBundles(),
    current,
    validLighthouse(),
  );
  assert.match(findings.join("\n"), /home gzip grew 11.0%/);
});

test("fails Lighthouse medians outside the release targets", () => {
  const lighthouse = validLighthouse();
  lighthouse.routes[0].runs = Array.from(
    { length: 3 },
    () => ({ lcpMs: 2_501, cls: 0.1 }),
  );
  lighthouse.routes[0].medianLcpMs = 2_501;
  lighthouse.routes[0].medianCls = 0.1;
  const findings = comparePerformance(
    validBundles(),
    validBundles(),
    lighthouse,
  );
  assert.match(findings.join("\n"), /LCP 2501ms/);
  assert.match(findings.join("\n"), /CLS 0.1/);
});

test("fails closed on missing routes, malformed runs, and wrong configuration", () => {
  const lighthouse = validLighthouse();
  lighthouse.configuration.formFactor = "desktop";
  lighthouse.routes.pop();
  lighthouse.routes[0].runs = [{ lcpMs: Number.NaN, cls: 0.05 }];
  const findings = comparePerformance(validBundles(), validBundles(), lighthouse);
  assert.match(findings.join("\n"), /mobile configuration/);
  assert.match(findings.join("\n"), /checkout is missing/);
  assert.match(findings.join("\n"), /exactly three finite runs/);
});

test("rejects relabeled URLs, duplicate routes, and altered network throttling", () => {
  const lighthouse = validLighthouse();
  lighthouse.configuration.throttling.rttMs = 0;
  lighthouse.routes[1].url = "/";
  lighthouse.routes[4] = { ...lighthouse.routes[0] };
  const findings = comparePerformance(validBundles(), validBundles(), lighthouse);
  assert.match(findings.join("\n"), /locked mobile configuration/);
  assert.match(findings.join("\n"), /exactly one result for each required route/);
  assert.match(findings.join("\n"), /search measured unexpected URL/);
});

test("rejects missing or extra bundle route labels", () => {
  const current = validBundles();
  delete current.routes.checkout;
  current.routes.account = { gzipBytes: 1 };
  const findings = comparePerformance(validBundles(), current, validLighthouse());
  assert.match(findings.join("\n"), /current bundle routes must exactly match/);
});
```

- [ ] **Step 2: Implement the comparison**

Create `compare-performance.mjs`:

```js
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_ROUTES = ["home", "search", "product", "cart", "checkout"];
const routeUrlIsValid = {
  home: (url) => url === "/",
  search: (url) => url === "/search?q=phone",
  product: (url) => /^\/product\/[^/?#]+$/.test(url),
  cart: (url) => url === "/cart",
  checkout: (url) => url === "/checkout",
};

export function comparePerformance(baseline, current, lighthouse) {
  const findings = [];
  for (const [label, measurement] of [
    ["baseline", baseline],
    ["current", current],
  ]) {
    const routeKeys = Object.keys(measurement?.routes ?? {}).sort();
    if (
      routeKeys.length !== REQUIRED_ROUTES.length ||
      routeKeys.some((route, index) => route !== [...REQUIRED_ROUTES].sort()[index])
    ) {
      findings.push(`${label} bundle routes must exactly match the required route set`);
    }
  }
  for (const route of REQUIRED_ROUTES) {
    const before = baseline?.routes?.[route];
    if (!before || !Number.isFinite(before.gzipBytes) || before.gzipBytes <= 0) {
      findings.push(`${route} is missing or invalid in baseline route measurements`);
      continue;
    }
    const after = current?.routes?.[route];
    if (!after) {
      findings.push(`${route} is missing from current route measurements`);
      continue;
    }
    if (!Number.isFinite(after.gzipBytes) || after.gzipBytes <= 0) {
      findings.push(`${route} is invalid in current route measurements`);
      continue;
    }
    const growth = ((after.gzipBytes - before.gzipBytes) / before.gzipBytes) * 100;
    if (growth > 10) findings.push(`${route} gzip grew ${growth.toFixed(1)}%`);
  }
  const configuration = lighthouse?.configuration;
  const throttling = configuration?.throttling;
  if (
    lighthouse?.schemaVersion !== 1 ||
    configuration?.viewport !== "390x844" ||
    configuration?.formFactor !== "mobile" ||
    configuration?.cpuSlowdown !== 4 ||
    configuration?.runsPerRoute !== 3 ||
    throttling?.rttMs !== 150 ||
    throttling?.throughputKbps !== 1638.4 ||
    throttling?.requestLatencyMs !== 150 ||
    throttling?.downloadThroughputKbps !== 1638.4 ||
    throttling?.uploadThroughputKbps !== 750
  ) {
    findings.push("Lighthouse artifact must use the locked mobile configuration");
  }
  const routes = Array.isArray(lighthouse?.routes) ? lighthouse.routes : [];
  const labels = routes.map((route) => route?.route);
  if (
    routes.length !== REQUIRED_ROUTES.length ||
    new Set(labels).size !== REQUIRED_ROUTES.length ||
    labels.some((label) => !REQUIRED_ROUTES.includes(label))
  ) {
    findings.push("Lighthouse must contain exactly one result for each required route");
  }
  for (const required of REQUIRED_ROUTES) {
    const route = routes.find((candidate) => candidate?.route === required);
    if (!route) {
      findings.push(`${required} is missing from Lighthouse measurements`);
      continue;
    }
    if (!routeUrlIsValid[required](route.url)) {
      findings.push(`${required} measured unexpected URL ${String(route.url)}`);
      continue;
    }
    const finiteRuns =
      Array.isArray(route.runs) &&
      route.runs.length === 3 &&
      route.runs.every(
        (run) => Number.isFinite(run?.lcpMs) && Number.isFinite(run?.cls),
      );
    if (!finiteRuns) {
      findings.push(`${required} must contain exactly three finite runs`);
      continue;
    }
    const lcp = [...route.runs].map((run) => run.lcpMs).sort((a, b) => a - b)[1];
    const cls = [...route.runs].map((run) => run.cls).sort((a, b) => a - b)[1];
    if (route.medianLcpMs !== lcp || route.medianCls !== cls) {
      findings.push(`${required} medians do not match raw runs`);
      continue;
    }
    if (lcp > 2_500) findings.push(`${required} LCP ${lcp}ms`);
    if (cls >= 0.1) findings.push(`${required} CLS ${cls}`);
  }
  return findings;
}

async function main() {
  const read = async (file) => JSON.parse(await readFile(path.join(feDir, file), "utf8"));
  const findings = comparePerformance(
    await read("performance/baseline/route-bundles.json"),
    await read("performance/current/route-bundles.json"),
    await read("performance/current/lighthouse-mobile.json"),
  );
  findings.forEach((finding) => console.error(finding));
  if (findings.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
```

- [ ] **Step 3: Add measurement and verification scripts**

Add:

```json
{
  "scripts": {
    "measure:performance": "pnpm run build && pnpm run measure:bundles -- --output performance/current/route-bundles.json && pnpm run measure:lighthouse -- --output performance/current/lighthouse-mobile.json",
    "verify:performance": "node scripts/compare-performance.mjs"
  }
}
```

Ensure both measurement scripts call `mkdir(path.dirname(output), { recursive: true })` before writing.

- [ ] **Step 4: Measure the production build**

Build the host output used by the bundle script, then rebuild the production
frontend container used by Lighthouse after seeded services are running:

```powershell
Push-Location fe
pnpm run build
Pop-Location
docker compose up -d --build frontend
Invoke-WebRequest -UseBasicParsing http://localhost:3000/healthz
```

Then run from `fe`:

```powershell
pnpm run measure:bundles -- --output performance/current/route-bundles.json
pnpm run measure:lighthouse -- --output performance/current/lighthouse-mobile.json
pnpm run verify:performance
```

Expected: `fe/dist/.vite/manifest.json` was produced by the immediately
preceding host build, all route growth is 10% or lower, every median LCP is
2500ms or lower, and every median CLS is below 0.1.

- [ ] **Step 5: Resolve performance failures with measured changes**

For route growth, inspect Vite manifest imports and remove duplicate feature imports, replace broad barrels with direct shared imports inside the owning feature, and lazy-load route-only editor/video/payment SDKs. For LCP, preload only the first real campaign/product image and reserve its dimensions. For CLS, add aspect ratio or fixed tracks to the measured shifting element.

Rerun all three measurement commands after each fix. Do not change the baseline files.

- [ ] **Step 6: Record, review, and commit**

Create `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-performance.md` with the baseline/current gzip bytes and growth percentage for all five routes plus all three Lighthouse runs and medians. Include the exact optimization and rerun evidence for every initial failure.

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory, including each performance artifact.
Add-ReviewedTaskFiles -Paths $taskFiles
git add -f docs/superpowers/reviews/2026-07-29-web-commerce-modernization-performance.md
git commit -m "perf(fe): enforce commerce release budgets"
```

### Task 4: Remove The Old Generation And Run The Full Gate

**Files:**
- Delete: `fe/src/shared/routing/commerce-preview.ts`
- Delete: `fe/src/shared/routing/commerce-preview.test.ts`
- Delete: `fe/src/app/components/ui/confirm-dialog.tsx`
- Delete: `fe/src/app/components/ui/confirm-dialog.test.tsx`
- Delete: `fe/src/app/components/ui/empty-state.tsx`
- Delete: `fe/src/app/components/ui/live-region.tsx`
- Delete: `fe/src/app/components/ui/modal.tsx`
- Delete: `fe/src/app/components/ui/page-skeleton.tsx`
- Delete: `fe/src/app/pages/Root.tsx`
- Delete: `fe/src/app/pages/seller/SellerPage.tsx`
- Delete: `fe/src/app/pages/seller/SellerDashboard.tsx`
- Delete: `fe/src/app/pages/seller/SellerProducts.tsx`
- Delete: `fe/src/app/pages/seller/SellerOrders.tsx`
- Delete: `fe/src/app/pages/seller/ShipDialog.tsx`
- Delete: `fe/src/app/pages/seller/SellerReviews.tsx`
- Delete: `fe/src/app/pages/seller/SellerWallet.tsx`
- Delete: `fe/src/app/pages/seller/SellerWallet.test.tsx`
- Delete: `fe/src/app/pages/seller/SellerSettings.tsx`
- Delete: `fe/src/app/pages/seller/index.ts`
- Delete: `fe/src/app/pages/admin/AdminPage.tsx`
- Delete: `fe/src/app/pages/admin/AdminDashboard.tsx`
- Delete: `fe/src/app/pages/admin/OrderManagement.tsx`
- Delete: `fe/src/app/pages/admin/OrderManagement.test.tsx`
- Delete: `fe/src/app/pages/admin/CouponsManagement.tsx`
- Delete: `fe/src/app/pages/admin/CouponDialog.tsx`
- Delete: `fe/src/app/pages/admin/UserManagement.tsx`
- Delete: `fe/src/app/pages/admin/SellersApproval.tsx`
- Delete: `fe/src/app/pages/admin/SellerApplicationDetail.tsx`
- Delete: `fe/src/app/pages/admin/ReviewsModeration.tsx`
- Delete: `fe/src/app/pages/admin/VideoModerationPanel.tsx`
- Delete: `fe/src/app/pages/admin/VideoModerationPanel.test.tsx`
- Delete: `fe/src/app/pages/admin/VideoModeration.tsx`
- Delete: `fe/src/app/pages/admin/VideoAppeals.tsx`
- Delete: `fe/src/app/pages/admin/DisputesQueue.tsx`
- Delete: `fe/src/app/pages/admin/PayoutsQueue.tsx`
- Delete: `fe/src/app/pages/admin/PayoutsQueue.test.tsx`
- Delete: `fe/src/app/pages/admin/SystemHealth.tsx`
- Delete: `fe/src/app/pages/admin/index.ts`
- Delete: `fe/src/app/components/product-card.tsx`
- Delete: `fe/src/app/components/console-chrome.tsx`
- Delete: `fe/src/app/components/seller-product-modal.tsx`
- Delete: `fe/src/app/components/seller-product-modal.test.tsx`
- Delete: `fe/src/app/components/form-dialog.tsx`
- Delete: `fe/src/app/components/form-dialog.test.tsx`
- Delete: `fe/src/app/components/status-pill.tsx`
- Create: `fe/scripts/check-cutover.test.mjs`
- Create: `fe/scripts/run-cutover-gate.ps1`
- Modify: `fe/src/app/routes.ts`
- Modify: `fe/src/app/layouts/StorefrontLayout.tsx`
- Modify: `fe/src/app/layouts/SellerLayout.tsx`
- Modify: `fe/src/app/layouts/AdminLayout.tsx`
- Modify: `fe/vite.config.ts`
- Modify: `fe/package.json`
- Modify: `fe/pnpm-lock.yaml`
- Modify: `fe/e2e/release-contract.spec.ts`
- Modify: `fe/performance/current/route-bundles.json`
- Modify: `fe/performance/current/lighthouse-mobile.json`
- Modify: `.github/workflows/promote.yml`
- Modify: `.github/workflows/cd.yml`
- Modify: `.github/workflows/verify-production.yml`
- Create: `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-integrated.md`
- Modify: `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-performance.md`

**Interfaces:**
- Consumes: all completed modernized features and release evidence.
- Produces: one production generation, no compatibility code, no preview switch, and a fully verified frontend commit.

- [ ] **Step 1: Write a failing cutover policy test**

Create `fe/scripts/check-cutover.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(target);
        return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
      }),
    )
  ).flat();
}

test("production source has no modernization preview or compatibility generation", async () => {
  const files = await sourceFiles(path.join(feDir, "src"));
  const source = (
    await Promise.all(files.map((file) => readFile(file, "utf8")))
  ).join("\n");
  const packageJson = JSON.parse(await readFile(path.join(feDir, "package.json"), "utf8"));
  assert.doesNotMatch(
    source,
    /__commercePreview|commerce-preview|currentGeneration|@tabler\/icons-react|figma:asset/,
  );
  assert.doesNotMatch(source, /app\/components\/ui/);
  assert.equal(packageJson.dependencies["@figma/astraui"], undefined);
  assert.equal(packageJson.dependencies["@tabler/icons-react"], undefined);

  for (const removed of [
    "src/shared/routing/commerce-preview.ts",
    "src/app/components/ui/confirm-dialog.tsx",
    "src/app/pages/Root.tsx",
    "src/app/pages/seller/SellerPage.tsx",
    "src/app/pages/admin/AdminPage.tsx",
  ]) {
    await assert.rejects(readFile(path.join(feDir, removed), "utf8"));
  }
});
```

- [ ] **Step 2: Run the policy test and confirm compatibility remains**

Run: `node --test fe/scripts/check-cutover.test.mjs`

Expected: FAIL while preview branches and old dependencies remain.

- [ ] **Step 3: Remove preview and compatibility modules**

Delete `commerce-preview` and every consumer branch. Point routes directly to modernized layouts/features. Use:

```powershell
rg -n "__commercePreview|commerce-preview|currentGeneration" fe/src
```

Expected after cleanup: no results.

Replace remaining app UI imports with `@/shared/ui`, then delete the app UI compatibility modules. Point seller/admin routes directly to feature route exports, then delete wrapper files that contain only re-exports. Delete `Root.tsx`, `SellerPage.tsx`, and `AdminPage.tsx` when route imports are zero.

- [ ] **Step 4: Remove superseded visual dependencies**

Use:

```powershell
rg -n "@tabler/icons-react|@figma/astraui|figma:asset" fe/src fe/vite.config.ts
```

Replace remaining Tabler icons with matching Lucide icons and remove the unused Figma asset resolver. Then run:

```powershell
pnpm remove @tabler/icons-react @figma/astraui
```

Delete old `ProductCard`, console chrome, modal, status, or layout implementations only after `rg` reports no imports. Do not remove a component still used by auth/payment-return routes; migrate that use first.

- [ ] **Step 5: Update the staging release contract**

Keep TLS, runtime config, auth, cookie, profile, and WebSocket assertions. Replace unsafe `Response.json()` casts with Zod schemas and `readJson`-equivalent local parsing. Add route checks:

```ts
await page.goto("/");
await expect(page.getByRole("link", { name: "VNShop" })).toBeVisible();
await expect(page.getByRole("searchbox")).toBeVisible();
await page.goto("/orders");
await expect(page.locator("#main-content")).toBeVisible();
```

Tag every test in this file `@staging-contract`. The local complete gate uses
`--grep-invert @staging-contract`, so no selected local test is skipped.
`promote.yml` runs this tagged contract with `E2E_RELEASE_CONTRACT=true` and
`E2E_REQUIRED_PERSONAS=buyer` against trusted staging TLS. The full exact-image
persona gate sets `E2E_REQUIRED_PERSONAS=buyer,seller,admin` before it invokes
`verify:e2e` and the complete suite.

Do not add seller/admin staging credentials to the public release contract;
their complete journeys are rerun against the exact cutover image below.

Give manual release runs unique identities in the same reviewed cutover commit:
add a required `dispatch_token` string input and a `run-name` containing both
`staging_revision` and that token to `promote.yml`. Add an optional
`dispatch_token` input to the manual branch of `verify-production.yml`; its
`run-name` contains the effective production revision and token, while
automatic `workflow_run` executions use the literal `automatic`. The token is
observability metadata only and must not affect artifact selection, lock
validation, or concurrency groups.

In `cd.yml`, add
`org.opencontainers.image.revision=${{ needs.prepare.outputs.source_commit }}`
to every `docker/build-push-action` image's OCI labels. The frontend exact-image
gate uses this reviewed label together with the immutable staging lock and
GitHub attestation to bind the image to source.

Also repair CD's existing "Verify signed provenance identity" step: it already
runs after registry login and stores no GitHub attestation record, so add
`--bundle-from-oci` to its `gh attestation verify` command. Add a workflow policy
test that fails when `create-storage-record: false` is paired with a verification
command lacking `--bundle-from-oci`; CD must be able to create the staging
desired-state PR before promotion begins.

Extend `promote.yml` before it creates the production desired-state PR:

- raise the protected job timeout to 90 minutes so three Lighthouse runs and
  complete persona journeys cannot be killed by the old release-contract-only
  limit;
- grant `packages: read`, authenticate GHCR with `${{ github.actor }}` and
  `${{ secrets.GITHUB_TOKEN }}`, and pull the exact frontend
  `image@digest` from `infra/release/locks/staging.json`;
- run `gh attestation verify oci://<image@digest> --bundle-from-oci` only after
  registry authentication, with the CD signer workflow and lock
  `sourceCommit`;
- after the existing Argo/live-image comparison proves staging is running that
  digest, set up Node 24, pnpm 9.15.9, Chromium, and buyer/seller/admin staging
  credentials from protected secrets;
- invoke `run-cutover-gate.ps1 -ExternalBaseUrl
  https://web.vnshop.invalid` for the locked image and source commit;
- upload the machine-readable full-suite, visual, accessibility, bundle, and
  Lighthouse evidence even on failure.

The protected job may open the production PR only after this exact-digest gate
passes. It never rebuilds the image.

- [ ] **Step 6: Commit the reviewed cutover source**

Run the non-browser gates, stage only Task 4's exact non-evidence
Create/Modify/Delete paths, review the complete cached diff, and commit before
building an image:

```powershell
$ErrorActionPreference = "Stop"
Push-Location fe
try {
  node --test scripts/check-cutover.test.mjs
  if ($LASTEXITCODE -ne 0) { throw "Cutover policy failed" }
  pnpm run typecheck
  if ($LASTEXITCODE -ne 0) { throw "Typecheck failed" }
  pnpm run lint:all
  if ($LASTEXITCODE -ne 0) { throw "Lint failed" }
  pnpm run format:check
  if ($LASTEXITCODE -ne 0) { throw "Format check failed" }
  pnpm run test
  if ($LASTEXITCODE -ne 0) { throw "Unit tests failed" }
  pnpm run build
  if ($LASTEXITCODE -ne 0) { throw "Host build failed" }
} finally {
  Pop-Location
}

# Set $cutoverSourceFiles to every exact non-evidence Create/Modify path in
# Task 4. Keep performance/current and review Markdown for Step 9.
Add-ReviewedTaskFiles -Paths $cutoverSourceFiles
$cutoverDeletes = git diff --name-only --diff-filter=D $env:LINT_BASE_SHA -- fe/src
# Compare this exact set with every Delete entry in Task 4 and abort on any
# missing or extra path, then stage each reviewed deletion.
$cutoverDeletes | ForEach-Object { git add -- $_ }
git diff --cached --check
git diff --cached --name-status
git diff --cached
git commit -m "feat(fe): cut over modernized commerce experience"
if ($LASTEXITCODE -ne 0) { throw "Cutover commit failed" }
$cutoverSourceSha = git rev-parse HEAD
if (git status --porcelain=v1 --untracked-files=no) {
  throw "Tracked worktree must be clean before the cutover image build"
}
```

- [ ] **Step 7: Build the committed source and run the reusable exact-image gate**

Create `fe/scripts/run-cutover-gate.ps1` with mandatory `-ImageReference` and
`-ExpectedSourceCommit` parameters plus optional `-ExternalBaseUrl`. The script
contains the complete image/browser/performance section and:

- defines `Invoke-Checked` so every native nonzero exit fails on Windows
  PowerShell 5.1;
- inspects the supplied immutable image reference and asserts its
  `org.opencontainers.image.revision` label equals `ExpectedSourceCommit`;
- in local mode, resolves the running API gateway's Compose network,
  stops/restores the Compose frontend, runs only the supplied image as
  `vnshop-fe-cutover`, and uses local HTTP solely for that deliberately
  insecure local build;
- in external mode, requires an HTTPS base URL, never starts the production
  image on local HTTP, and uses the already verified staging deployment for
  readiness, browser, and Lighthouse traffic;
- in external mode, sets `VITE_E2E_API_URL` from the trusted API origin paired
  with `ExternalBaseUrl` and forwards protected buyer/seller/admin credential
  environment variables to every Playwright and Lighthouse command;
- in both modes, polls `/healthz` and `/runtime-config.json` with bounded
  60-second retries before browser work;
- copies `/usr/share/nginx/html` from the exact image using a temporary
  create/copy/remove container, without starting it in external mode;
- removes prior current measurements; sets the required persona environment and
  runs `verify:e2e` immediately before any Playwright or Lighthouse command;
  local mode then runs `test:e2e:local-complete`, while external mode sets
  `E2E_RELEASE_CONTRACT=true`, `E2E_REQUIRED_PERSONAS=buyer,seller,admin`, and
  runs the complete suite including `@staging-contract`; both machine-validate
  zero selected skips/failures, then run modernization, state, Axe, bundle,
  three-run Lighthouse, and performance
  gates; visual comparison is delegated to
  `run-visual-linux.ps1 -Mode compare` so baseline generation and enforcement
  use the identical pinned Linux Playwright image;
- keeps temporary container removal, environment restoration,
  copied-dist cleanup, and local Compose frontend restoration in
  `try/finally`.

Use this readiness helper inside the script:

```powershell
function Wait-HttpOk([string] $Uri, [int] $TimeoutSeconds = 60) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 5
      if ($response.StatusCode -eq 200) { return }
    } catch {
      if ((Get-Date) -ge $deadline) { throw }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for $Uri"
}
```

Build from a temporary detached worktree at the recorded commit, never from
the live `fe` directory where untracked files could enter `COPY . .`, then call
the reusable gate:

```powershell
$cutoverTag = "vnshop/frontend:commerce-modernization-$($cutoverSourceSha.Substring(0,12))"
$cutoverBuildTree = Join-Path $env:TEMP "vnshop-cutover-build-$cutoverSourceSha"
if (Test-Path -LiteralPath $cutoverBuildTree) {
  throw "Cutover build worktree path already exists: $cutoverBuildTree"
}
git worktree add --detach $cutoverBuildTree $cutoverSourceSha
if ($LASTEXITCODE -ne 0) { throw "Could not create exact cutover build tree" }
try {
  docker build `
    --label "org.opencontainers.image.revision=$cutoverSourceSha" `
    --build-arg VITE_ALLOW_INSECURE_RUNTIME_CONFIG=true `
    -f "$cutoverBuildTree/fe/Dockerfile" `
    -t $cutoverTag `
    "$cutoverBuildTree/fe"
  if ($LASTEXITCODE -ne 0) { throw "Cutover image build failed" }
} finally {
  git worktree remove --force $cutoverBuildTree
  if ($LASTEXITCODE -ne 0) { throw "Could not remove cutover build tree" }
}
& fe/scripts/run-cutover-gate.ps1 `
  -ImageReference $cutoverTag `
  -ExpectedSourceCommit $cutoverSourceSha
if ($LASTEXITCODE -ne 0) { throw "Exact-image cutover gate failed" }
```

Update performance evidence with `$cutoverSourceSha`, the inspected local image
ID, all three fresh raw Lighthouse runs, and the final bundle comparison.
Expected: every gate passes against the committed image, both readiness
endpoints return HTTP 200 after bounded polling, and no stale measurement can
satisfy the gate.

- [ ] **Step 8: Perform integrated independent review**

Use `superpowers:requesting-code-review` with:

- requirements: the approved design specification and this complete plan suite;
- base SHA: `8c7cbc5b`;
- head SHA: current `HEAD`;
- emphasis: checkout duplicate-order invariant, runtime decoding, dependency direction, route/guard preservation, unsupported capabilities, localization, responsive behavior, performance evidence, and release rollback.

Resolve every Critical and Important finding. If a finding changes any
image-owned file, commit the fix, recapture `$cutoverSourceSha`, require a clean
tracked tree, rebuild, and rerun Step 7 before accepting the review. Create
`docs/superpowers/reviews/2026-07-29-web-commerce-modernization-integrated.md`
with reviewed range, findings by severity, resolutions, verification commands,
residual risks, and reviewer disposition.

- [ ] **Step 9: Commit exact-image evidence**

```powershell
$evidenceFiles = @(
  "fe/performance/current/route-bundles.json",
  "fe/performance/current/lighthouse-mobile.json"
)
Add-ReviewedTaskFiles -Paths $evidenceFiles
git add -f docs/superpowers/reviews/2026-07-29-web-commerce-modernization-integrated.md docs/superpowers/reviews/2026-07-29-web-commerce-modernization-performance.md
git diff --cached --check
git diff --cached --name-status
git diff --cached
git commit -m "docs: record exact frontend cutover evidence"
```

### Task 5: Promote One Reviewed Frontend Generation

**Files:**
- Verify: `.github/workflows/ci.yml`
- Verify: `.github/workflows/cd.yml`
- Verify: `.github/workflows/promote.yml`
- Verify: `.github/workflows/rollback.yml`
- Verify: `.github/workflows/verify-production.yml`
- Verify: `fe/scripts/run-cutover-gate.ps1`
- Create: `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-release.md`

**Interfaces:**
- Consumes: reviewed cutover commit, 19-artifact staging lock, staging Argo reconciliation, release contract, and existing immutable promotion/rollback workflows.
- Produces: one protected production pull request and recorded rollback target.

- [ ] **Step 1: Verify the release diff and CI**

Run:

```powershell
git status --short
git diff --check 8c7cbc5b..HEAD
$implementationPrNumber = gh pr view --json number --jq ".number"
if ([string]::IsNullOrWhiteSpace($implementationPrNumber)) {
  throw "Could not resolve the implementation pull request"
}
$releaseHead = git rev-parse HEAD
$ciRun = gh run list --workflow ci.yml --branch (git branch --show-current) `
  --limit 50 --json databaseId,headSha,status,conclusion,event |
  ConvertFrom-Json |
  Where-Object { $_.headSha -eq $releaseHead -and $_.event -in @("push", "pull_request") } |
  Select-Object -First 1
if (!$ciRun) { throw "No CI run found for exact release head $releaseHead" }
if ($ciRun.status -ne "completed") {
  gh run watch $ciRun.databaseId --exit-status
  if ($LASTEXITCODE -ne 0) { throw "CI failed for $releaseHead" }
}
$ciRun = gh run view $ciRun.databaseId --json headSha,status,conclusion | ConvertFrom-Json
if ($ciRun.headSha -ne $releaseHead -or $ciRun.status -ne "completed" -or $ciRun.conclusion -ne "success") {
  throw "Exact release-head CI is not successful"
}
```

Expected: only intended modernization files differ, no whitespace errors exist, and frontend CI plus frontend container scan pass.

- [ ] **Step 2: Merge through review and capture the staging revision**

Before promotion, capture the current protected production head as the
immutable rollback target and verify that it contains a valid production lock.
After the implementation pull request has required approval and green checks,
merge it through repository protection and immediately capture that merge as
`$implementationMergeCommit`. Wait for `.github/workflows/cd.yml` to build
immutable artifacts and open the staging desired-state pull request. After that
protected PR merges, capture its full 40-character main commit and validate
from a detached worktree at that exact revision:

```powershell
$implementationPr = gh pr view $implementationPrNumber `
  --json mergedAt,mergeCommit |
  ConvertFrom-Json
if (!$implementationPr.mergedAt -or !$implementationPr.mergeCommit.oid) {
  throw "Implementation pull request is not merged"
}
$implementationMergeCommit = $implementationPr.mergeCommit.oid
git fetch origin production main
$knownGoodRevision = git rev-parse origin/production
git show "$($knownGoodRevision):infra/release/locks/prod.json" |
  Set-Content "$env:TEMP/vnshop-known-good-prod.json"
$knownGoodLock = Get-Content -Raw "$env:TEMP/vnshop-known-good-prod.json" | ConvertFrom-Json
if ($knownGoodLock.artifacts.Count -ne 19) { throw "Known-good production lock is incomplete" }

$stagingRevision = git rev-parse origin/main
$stagingTree = Join-Path $env:TEMP "vnshop-staging-$stagingRevision"
if (Test-Path -LiteralPath $stagingTree) {
  throw "Detached staging worktree path already exists: $stagingTree"
}
git worktree add --detach $stagingTree $stagingRevision
if ($LASTEXITCODE -ne 0) { throw "Could not create exact staging worktree" }
try {
  Push-Location $stagingTree
  try {
    python infra/scripts/validate-k8s-release.py --environment staging
    if ($LASTEXITCODE -ne 0) { throw "Exact-tree staging validation failed" }
    $stagingLock = Get-Content -Raw "infra/release/locks/staging.json" |
      ConvertFrom-Json
    if ($stagingLock.artifacts.Count -ne 19) {
      throw "Staging lock is incomplete"
    }
    if ($stagingLock.sourceCommit -ne $implementationMergeCommit) {
      throw "Staging lock does not belong to the reviewed implementation merge"
    }
    $frontendArtifacts = @(
      $stagingLock.artifacts | Where-Object { $_.id -eq "frontend" }
    )
    if ($frontendArtifacts.Count -ne 1) {
      throw "Staging lock must contain exactly one frontend artifact"
    }
    $frontendImage = "$($frontendArtifacts[0].image)@$($frontendArtifacts[0].digest)"
  } finally {
    Pop-Location
  }
} finally {
  git worktree remove --force $stagingTree
  if ($LASTEXITCODE -ne 0) { throw "Could not remove staging worktree" }
}
```

Expected: the rollback target is a full 40-character ancestor of
`origin/production`, its lock contains all 19 artifacts, and the staging lock
validates from its own tree; `sourceCommit` equals the reviewed implementation
merge; and exactly one locked frontend image/digest is captured. Write both
revisions and the image digest into the release evidence draft immediately.
The protected promotion in Step 4 authenticates to OCI, verifies provenance,
proves that digest is live behind trusted staging TLS, and runs the complete
external exact-image gate before it can open a production PR.

- [ ] **Step 3: Verify dispatched release-run identity**

Confirm the reviewed workflows on `origin/main` contain the token inputs and
run-name formats committed during cutover. Abort if the remote workflow does
not match the local reviewed file; do not dispatch against an older workflow.

```powershell
git fetch origin main
git diff --exit-code origin/main -- .github/workflows/promote.yml .github/workflows/verify-production.yml
if ($LASTEXITCODE -ne 0) { throw "Remote release workflows differ from the reviewed cutover" }
```

- [ ] **Step 4: Run the existing protected promotion**

Dispatch:

```powershell
$promotionToken = [guid]::NewGuid().ToString("N")
$promotionTitle = "Promote $stagingRevision [$promotionToken]"
$promotionDeadline = (Get-Date).AddMinutes(10)
gh workflow run promote.yml --ref main `
  -f staging_revision=$stagingRevision `
  -f dispatch_token=$promotionToken
if ($LASTEXITCODE -ne 0) { throw "Promotion dispatch failed" }
do {
  Start-Sleep -Seconds 5
  $promotionRun = gh run list --workflow promote.yml --event workflow_dispatch `
    --limit 50 --json databaseId,headSha,displayTitle |
    ConvertFrom-Json |
    Where-Object { $_.displayTitle -eq $promotionTitle } |
    Select-Object -First 1
  if (!$promotionRun -and (Get-Date) -ge $promotionDeadline) {
    throw "Timed out locating the dispatched promotion run"
  }
} until ($promotionRun)
gh run watch $promotionRun.databaseId --exit-status
if ($LASTEXITCODE -ne 0) { throw "Promotion run failed" }
$observedPromotionTitle = gh run view $promotionRun.databaseId --json displayTitle --jq '.displayTitle'
if ($observedPromotionTitle -ne $promotionTitle) { throw "Promotion run identity mismatch" }
```

Expected: staging is Synced and Healthy at the exact revision, live image IDs
match the immutable lock, OCI-only provenance verifies after GHCR login, the
complete buyer/seller/admin, visual, accessibility, bundle, and Lighthouse gate
passes against trusted staging TLS, the load budget passes, and only then does
the workflow open a protected production PR without rebuilding images.

- [ ] **Step 5: Approve production and verify reconciliation**

Review the generated production PR and confirm the frontend digest equals
staging. After Code Owner approval and merge, explicitly dispatch and watch the
manual branch of `.github/workflows/verify-production.yml`; the automatic
workflow-run trigger remains as a second protected signal:

```powershell
git fetch origin production
$productionRevision = git rev-parse origin/production
$verificationToken = [guid]::NewGuid().ToString("N")
$verificationTitle = "Verify production $productionRevision [$verificationToken]"
$verificationDeadline = (Get-Date).AddMinutes(15)
gh workflow run verify-production.yml --ref production `
  -f production_revision=$productionRevision `
  -f dispatch_token=$verificationToken
if ($LASTEXITCODE -ne 0) { throw "Production verification dispatch failed" }
do {
  Start-Sleep -Seconds 5
  $verificationRun = gh run list --workflow verify-production.yml `
    --event workflow_dispatch --limit 50 --json databaseId,headSha,displayTitle |
    ConvertFrom-Json |
    Where-Object { $_.displayTitle -eq $verificationTitle } |
    Select-Object -First 1
  if (!$verificationRun -and (Get-Date) -ge $verificationDeadline) {
    throw "Timed out locating production verification for $productionRevision"
  }
} until ($verificationRun)
gh run watch $verificationRun.databaseId --exit-status
if ($LASTEXITCODE -ne 0) { throw "Production verification run failed" }
$observedVerificationTitle = gh run view $verificationRun.databaseId --json displayTitle --jq '.displayTitle'
if ($observedVerificationTitle -ne $verificationTitle) { throw "Production run identity mismatch" }
```

Expected: production Argo reports Synced/Healthy at the exact production revision and all live image IDs match the production lock.

- [ ] **Step 6: Record release and rollback evidence**

Create `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-release.md` with:

- implementation merge commit;
- staging desired-state revision;
- frontend image name and digest;
- promotion workflow run URL;
- exact-digest staging gate artifact URL and summary;
- production PR URL and merge commit;
- production verification run URL;
- known-good pre-release production revision for rollback;
- links to baseline, visual, performance, and integrated review evidence.

If production verification fails, do not rebuild. Dispatch the existing immutable rollback workflow with the recorded known-good production revision:

```powershell
gh workflow run rollback.yml -f target_revision=$knownGoodRevision -f reason="Frontend commerce modernization verification failed"
```

- [ ] **Step 7: Review and commit release evidence**

After successful production verification:

```powershell
git add -f docs/superpowers/reviews/2026-07-29-web-commerce-modernization-release.md
git commit -m "docs: record commerce modernization release"
```

Request final review of the evidence-only commit. The initiative is complete when production verification is green and no required finding remains unresolved.

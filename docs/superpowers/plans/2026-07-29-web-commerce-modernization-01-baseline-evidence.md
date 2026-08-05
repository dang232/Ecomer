# VNShop Web Commerce Modernization Baseline Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the frontend toolchain reproducible and record route, quality, performance, and journey baselines before behavior or visual structure changes.

**Architecture:** pnpm becomes the only frontend package runner in source, CI, promotion, and docs; frontend app, unit-test, and E2E code receive explicit typecheck entry points. Deterministic scripts capture route bundle sizes and three-run Lighthouse medians against the production build and seeded data.

**Tech Stack:** pnpm 9.15.9, TypeScript 5.6, ESLint 9, Vite 7.3.6, Vitest 4, Playwright 1.60, Lighthouse 13.4.1, chrome-launcher 1.2.1.

## Global Constraints

- Preserve the approved product behavior and all public routes.
- Use pnpm 9.15.9 for frontend installs and scripts.
- Do not change application presentation in this plan.
- Do not weaken existing ESLint rules or raise the global warning baseline.
- Changed production code must have zero ESLint warnings.
- Include unit tests and E2E TypeScript in explicit typecheck projects.
- Record evidence before later plans change route chunks or rendered layouts.
- Run the master plan Review Gate after every task.
- Do not stage or commit `fe/.ua/`.

---

### Task 1: Normalize Frontend Toolchain And Documentation

**Files:**
- Modify: `fe/package.json`
- Modify: `fe/pnpm-lock.yaml`
- Modify: `fe/Dockerfile`
- Delete: `fe/package-lock.json`
- Modify: `fe/playwright.config.ts`
- Modify: `.github/workflows/promote.yml`
- Modify: `fe/README.md`
- Modify: `.agents/fe/AGENTS.md`
- Modify: `docs/superpowers/specs/2026-07-29-web-commerce-modernization-design.md`
- Test: `fe/scripts/check-package-manager.test.mjs`

**Interfaces:**
- Consumes: `packageManager: "pnpm@9.15.9"` from `fe/package.json`.
- Produces: one frontend lockfile, pnpm-only frontend commands, React DOM types aligned to `19.2.3`, and `pnpm run lint:changed -- --base <sha>`.

- [ ] **Step 1: Capture the task base and write a failing policy test**

Create `fe/scripts/check-package-manager.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(feDir, "..");

test("frontend uses one pnpm lockfile and pnpm commands", async () => {
  const packageJson = JSON.parse(await readFile(path.join(feDir, "package.json"), "utf8"));
  const scripts = Object.values(packageJson.scripts).join("\n");
  const promote = await readFile(path.join(rootDir, ".github", "workflows", "promote.yml"), "utf8");
  const dockerfile = await readFile(path.join(feDir, "Dockerfile"), "utf8");
  const docs = await Promise.all([
    readFile(path.join(feDir, "README.md"), "utf8"),
    readFile(path.join(rootDir, ".agents", "fe", "AGENTS.md"), "utf8"),
  ]);

  assert.equal(packageJson.packageManager, "pnpm@9.15.9");
  assert.equal(packageJson.devDependencies["@types/react-dom"], "19.2.3");
  assert.doesNotMatch(scripts, /\bnpm run\b/);
  assert.doesNotMatch(promote, /\bnpm ci\b|\bnpx playwright\b|fe\/package-lock\.json/);
  assert.match(dockerfile, /^FROM node:24-alpine@sha256:[0-9a-f]{64} AS build$/m);
  assert.match(
    dockerfile,
    /^FROM nginxinc\/nginx-unprivileged:[^\s@]+@sha256:[0-9a-f]{64} AS runtime$/m,
  );
  assert.match(dockerfile, /^RUN pnpm run build$/m);
  assert.doesNotMatch(dockerfile, /\bnpx vite build\b/);
  assert.doesNotMatch(dockerfile, /\bapk upgrade\b/);
  assert.doesNotMatch(docs.join("\n"), /\bnpm run\b/);
  await assert.rejects(readFile(path.join(feDir, "package-lock.json"), "utf8"));
});
```

- [ ] **Step 2: Run the policy test and confirm the current drift**

Run: `node --test fe/scripts/check-package-manager.test.mjs`

Expected: FAIL because `@types/react-dom` is 18.x, npm commands remain, and `fe/package-lock.json` exists.

- [ ] **Step 3: Make package scripts and the promotion job pnpm-only**

In `fe/package.json`, set `"@types/react-dom": "19.2.3"` and replace internal `npm run` calls:

```json
{
  "scripts": {
    "lint:tokens": "pnpm run tokens:check && node scripts/check-design-tokens.mjs",
    "lint:all": "pnpm run lint && pnpm run lint:i18n && pnpm run lint:tokens",
    "verify": "pnpm run typecheck && pnpm run lint && pnpm run lint:i18n && pnpm run lint:tokens && pnpm run format:check && pnpm run test && pnpm run build"
  }
}
```

Resolve and review immutable digests for the Node 24 Alpine builder and the
existing unprivileged nginx runtime, then pin both `FROM` lines by digest.
Remove runtime `apk upgrade`; base remediation is a reviewed digest update, not
a mutable package operation during each build.

In `fe/playwright.config.ts`, set:

```ts
command: "pnpm run dev",
```

In `.github/workflows/promote.yml`, use:

```yaml
- name: Install pnpm
  uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.0.0
  with:
    version: 9.15.9

- name: Set up Node.js
  uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
  with:
    node-version: "24"
    cache: pnpm
    cache-dependency-path: fe/pnpm-lock.yaml

- name: Install the release browser
  working-directory: fe
  run: |
    pnpm install --frozen-lockfile
    pnpm exec playwright install --with-deps chromium

- name: Verify the public release contract
  working-directory: fe
  run: pnpm exec playwright test e2e/release-contract.spec.ts --project=chromium
```

Remove the earlier npm-cached `Set up Node.js` block, update frontend commands in `fe/README.md` and `.agents/fe/AGENTS.md`, and correct those docs to React 19.2.8 and Vite 7.3.6. Delete `fe/package-lock.json`; do not alter npm usage for Node microservices.

Change the frontend Docker build stage to `node:24-alpine` and replace
`RUN npx vite build` with `RUN pnpm run build`. The image and host gates must
therefore use the same major Node runtime, package manager, lockfile, typecheck,
and Vite build script.

Update the design specification metadata to:

```markdown
**Status:** Approved
```

Replace section 6.3 ownership with:

```markdown
`fe/src/shared/ui` owns canonical foundation components. Modules under
`fe/src/app/components/ui` may temporarily re-export canonical components during
migration, but contain no new primitive implementation and are removed before release.
```

- [ ] **Step 4: Refresh the pnpm lock and verify policy**

Run: `pnpm install --lockfile-only`

Working directory: `fe`

Expected: PASS and `pnpm-lock.yaml` records `@types/react-dom` 19.2.3.

Run: `node --test fe/scripts/check-package-manager.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run the baseline frontend checks**

Run from `fe`:

```powershell
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

Expected: typecheck, tests, and build pass; lint has zero errors and no more than the previously recorded 28 warnings.

- [ ] **Step 6: Review and commit**

Use the master Review Gate, then commit:

```powershell
git add fe/package.json fe/pnpm-lock.yaml fe/Dockerfile fe/playwright.config.ts fe/scripts/check-package-manager.test.mjs fe/README.md .agents/fe/AGENTS.md .github/workflows/promote.yml docs/superpowers/specs/2026-07-29-web-commerce-modernization-design.md
git add -u fe/package-lock.json
git commit -m "build(fe): standardize pnpm and React 19 types"
```

### Task 2: Typecheck Every Frontend TypeScript Surface

**Files:**
- Modify: `fe/tsconfig.json`
- Create: `fe/tsconfig.test.json`
- Create: `fe/tsconfig.e2e.json`
- Modify: `fe/tsconfig.app.json`
- Modify: `fe/eslint.config.js`
- Modify: `fe/package.json`
- Modify: `fe/scripts/hydrate-e2e.mjs`
- Test: `fe/scripts/hydrate-e2e.test.mjs`
- Create: `fe/scripts/lint-changed.mjs`
- Test: `fe/scripts/lint-changed.test.mjs`

**Interfaces:**
- Consumes: current app `@/* -> src/*` alias and strict compiler options.
- Produces: `typecheck:app`, `typecheck:test`, `typecheck:e2e`,
  `typecheck:node`, aggregate `typecheck`, recursive E2E hydration, and
  `lint:changed -- --base <git-ref>`.

- [ ] **Step 1: Write failing changed-file lint tests**

Create `fe/scripts/lint-changed.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { parseBase, selectLintableFiles } from "./lint-changed.mjs";

test("parseBase requires a value after --base", () => {
  assert.throws(() => parseBase(["--base"]), /--base requires a git ref/);
});

test("selectLintableFiles keeps changed frontend TS and TSX only", () => {
  assert.deepEqual(
    selectLintableFiles([
      "fe/src/app/App.tsx",
      "fe/src/shared/lib/cn.ts",
      "README.md",
      "services/cart-service/src/main.ts",
      "fe/src/styles/theme.css",
    ]),
    ["src/app/App.tsx", "src/shared/lib/cn.ts"],
  );
});
```

- [ ] **Step 2: Run the script test and confirm the module is missing**

Run: `node --test fe/scripts/lint-changed.test.mjs`

Expected: FAIL with module-not-found for `lint-changed.mjs`.

- [ ] **Step 3: Add strict test and E2E projects**

Create `fe/tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "types": ["node", "vite/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

Create `fe/tsconfig.e2e.json`:

```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "types": ["node", "vite/client", "@playwright/test"]
  },
  "include": ["e2e/**/*.ts", "playwright.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Change `fe/tsconfig.json` references:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Keep production tests excluded from `tsconfig.app.json`. The dedicated test and
E2E configs are non-composite projects invoked directly by the scripts below;
this lets tests import production modules without `TS6307` while retaining
separate test globals. Before continuing, run both project commands and confirm
there are no "file is not listed within the file list of project" diagnostics.

- [ ] **Step 4: Enable typed linting for tests and E2E**

Remove `e2e` from the global ignores in `fe/eslint.config.js`. Split the current combined test/config override: keep `**/*.config.{ts,js,mjs,cjs}` in its own `disableTypeChecked` override, and replace the test portion with explicit typed projects and test-only globals:

```js
{
  files: ["**/*.test.{ts,tsx}", "**/test-setup.ts"],
  languageOptions: {
    globals: { ...globals.browser, ...globals.node },
    parserOptions: {
      projectService: false,
      project: "./tsconfig.test.json",
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
  },
},
{
  files: ["e2e/**/*.ts"],
  languageOptions: {
    globals: { ...globals.browser, ...globals.node },
    parserOptions: {
      projectService: false,
      project: "./tsconfig.e2e.json",
      tsconfigRootDir: import.meta.dirname,
    },
  },
},
```

Do not suppress existing test errors globally. Fix each reported fixture with inferred schema types, `satisfies`, or typed test builders.

- [ ] **Step 5: Implement changed-file lint**

Create `fe/scripts/lint-changed.mjs`:

```js
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(feDir, "..");
const require = createRequire(import.meta.url);
const eslintPackage = require.resolve("eslint/package.json");
const eslintCli = path.join(path.dirname(eslintPackage), "bin", "eslint.js");

export function parseBase(args) {
  const index = args.indexOf("--base");
  if (index === -1) return "HEAD^";
  const value = args[index + 1];
  if (!value) throw new Error("--base requires a git ref");
  return value;
}

export function selectLintableFiles(files) {
  return files
    .filter((file) => /^fe\/.*\.(ts|tsx)$/.test(file))
    .map((file) => file.slice("fe/".length));
}

function main() {
  const base = parseBase(process.argv.slice(2));
  const changed = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", base, "--", "fe"],
    { cwd: rootDir, encoding: "utf8" },
  );
  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "--", "fe"],
    { cwd: rootDir, encoding: "utf8" },
  );
  const files = selectLintableFiles(
    `${changed}\n${untracked}`.split(/\r?\n/).filter(Boolean),
  );
  if (files.length === 0) return;
  const result = spawnSync(
    process.execPath,
    [eslintCli, "--max-warnings", "0", ...files],
    { cwd: feDir, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

Add scripts:

```json
{
  "scripts": {
    "typecheck:app": "tsc -p tsconfig.app.json --noEmit",
    "typecheck:test": "tsc -p tsconfig.test.json --noEmit",
    "typecheck:e2e": "tsc -p tsconfig.e2e.json --noEmit",
    "typecheck:node": "tsc -p tsconfig.node.json --noEmit",
    "typecheck": "pnpm run typecheck:app && pnpm run typecheck:test && pnpm run typecheck:e2e && pnpm run typecheck:node",
    "lint:changed": "node scripts/lint-changed.mjs"
  }
}
```

Refactor `hydrate-e2e.mjs` to recursively enumerate every `*.spec.ts` under
`fe/e2e`, including `journey`, `specs`, and `modernization` directories. Export
the pure collector and add `hydrate-e2e.test.mjs` with a nested temporary tree
that proves top-level and deeply nested specs are returned while non-spec files
are excluded. Hydration must fail with the offending path when any discovered
spec cannot be read; it must not silently omit a OneDrive placeholder or
reparse-point subtree.

- [ ] **Step 6: Fix surfaced test and E2E type errors without escapes**

For fixture arrays, replace unsafe declarations such as:

```ts
content: [] as any[],
```

with the endpoint-derived type:

```ts
const emptyOrdersPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  number: 0,
  size: 20,
} satisfies OrdersPage;
```

Use the canonical exported response type at each failing site. Do not use `unknown as`, `as any`, non-null assertions, or lint disables to make the new projects pass.

- [ ] **Step 7: Verify all TypeScript surfaces**

Run from `fe`:

```powershell
node --test scripts/lint-changed.test.mjs
node --test scripts/hydrate-e2e.test.mjs
pnpm run typecheck
pnpm run lint
pnpm run test
```

Expected: all commands pass; global lint has zero errors and does not exceed 28 pre-existing warnings.

- [ ] **Step 8: Review and commit**

Use the master Review Gate, then commit:

```powershell
git add fe/tsconfig.json fe/tsconfig.app.json fe/tsconfig.test.json fe/tsconfig.e2e.json fe/eslint.config.js fe/package.json fe/scripts/lint-changed.mjs fe/scripts/lint-changed.test.mjs fe/scripts/hydrate-e2e.mjs fe/scripts/hydrate-e2e.test.mjs
git commit -m "build(fe): typecheck tests and browser journeys"
```

### Task 3: Record Acceptance, Bundle, And Lighthouse Baselines

**Files:**
- Create: `fe/e2e/fixtures/commerce-acceptance.ts`
- Create: `fe/e2e/baseline-commerce.spec.ts`
- Create: `fe/scripts/measure-route-bundles.mjs`
- Test: `fe/scripts/measure-route-bundles.test.mjs`
- Create: `fe/scripts/measure-lighthouse.mjs`
- Modify: `fe/vite.config.ts`
- Modify: `fe/package.json`
- Modify: `fe/pnpm-lock.yaml`
- Create: `fe/performance/baseline/route-bundles.json`
- Create: `fe/performance/baseline/lighthouse-mobile.json`
- Create: `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-baseline.md`

**Interfaces:**
- Consumes: seeded buyer/seller/admin accounts documented by `infra/scripts/seed-demo.mjs`, production Vite output, and existing route URLs.
- Produces: typed `COMMERCE_ACCEPTANCE`, route gzip baseline, three-run mobile Lighthouse medians, and deterministic buyer journey proxies.

- [ ] **Step 1: Define the typed acceptance matrix**

Create `fe/e2e/fixtures/commerce-acceptance.ts`:

```ts
import type { APIRequestContext } from "@playwright/test";
import { z } from "zod";

export interface AcceptanceRoute {
  path: string;
  persona: "public" | "buyer" | "seller" | "admin";
  states: readonly (
    | "loading"
    | "empty"
    | "partial"
    | "error"
    | "ready"
    | "pending"
    | "success"
  )[];
  viewports: readonly ("mobile" | "tablet" | "desktop" | "wide")[];
}

const productListSchema = z.object({
  data: z.object({
    content: z.array(z.object({ id: z.string().min(1) })).min(1),
  }),
});

export const COMMERCE_ACCEPTANCE = [
  { path: "/", persona: "public", states: ["loading", "partial", "ready"], viewports: ["mobile", "tablet", "desktop", "wide"] },
  { path: "/search?q=phone", persona: "public", states: ["loading", "empty", "error", "ready"], viewports: ["mobile", "tablet", "desktop", "wide"] },
  { path: "/product/{seededProductId}", persona: "public", states: ["loading", "error", "ready"], viewports: ["mobile", "tablet", "desktop", "wide"] },
  { path: "/sellers/{acceptanceSellerId}", persona: "public", states: ["loading", "error", "ready"], viewports: ["mobile", "desktop"] },
  { path: "/cart", persona: "buyer", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/checkout", persona: "buyer", states: ["loading", "empty", "error", "ready", "pending", "success"], viewports: ["mobile", "desktop"] },
  { path: "/payment/return/vnpay", persona: "buyer", states: ["loading", "error", "ready", "success"], viewports: ["mobile", "desktop"] },
  { path: "/orders", persona: "buyer", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/orders/{acceptanceOrderId}", persona: "buyer", states: ["loading", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/returns", persona: "buyer", states: ["loading", "empty", "error", "ready"], viewports: ["mobile", "desktop"] },
  { path: "/returns/new?orderId={acceptanceOrderId}", persona: "buyer", states: ["loading", "error", "ready", "pending", "success"], viewports: ["mobile", "desktop"] },
  { path: "/profile", persona: "buyer", states: ["loading", "error", "ready", "pending", "success"], viewports: ["mobile", "desktop"] },
  { path: "/wishlist", persona: "buyer", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/messages", persona: "buyer", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/notifications", persona: "buyer", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/notifications/preferences", persona: "buyer", states: ["loading", "error", "ready", "pending", "success"], viewports: ["mobile", "desktop"] },
  { path: "/seller", persona: "seller", states: ["loading", "partial", "error", "ready"], viewports: ["mobile", "desktop"] },
  { path: "/seller/products", persona: "seller", states: ["loading", "empty", "error", "ready", "pending", "success"], viewports: ["mobile", "desktop"] },
  { path: "/seller/orders", persona: "seller", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/seller/reviews", persona: "seller", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/seller/wallet", persona: "seller", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/seller/settings", persona: "seller", states: ["loading", "error", "ready"], viewports: ["mobile", "desktop"] },
  { path: "/admin", persona: "admin", states: ["loading", "partial", "error", "ready"], viewports: ["mobile", "desktop"] },
  { path: "/admin/sellers", persona: "admin", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/admin/reviews", persona: "admin", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/admin/video", persona: "admin", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/admin/coupons", persona: "admin", states: ["loading", "empty", "error", "ready", "pending", "success"], viewports: ["mobile", "desktop"] },
  { path: "/admin/disputes", persona: "admin", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/admin/payouts", persona: "admin", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/admin/users", persona: "admin", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/admin/orders", persona: "admin", states: ["loading", "empty", "error", "ready", "pending"], viewports: ["mobile", "desktop"] },
  { path: "/admin/health", persona: "admin", states: ["loading", "partial", "error", "ready"], viewports: ["mobile", "desktop"] },
] as const satisfies readonly AcceptanceRoute[];

export const ACCEPTANCE_VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
  wide: { width: 1440, height: 900 },
} as const;

export async function resolveAcceptancePath(
  request: APIRequestContext,
  path: string,
): Promise<string> {
  const fixed = path
    .replace("{acceptanceOrderId}", "00000000-0000-4000-8000-000000000001")
    .replace("{acceptanceSellerId}", "00000000-0000-4000-8000-000000000002");
  if (!fixed.includes("{seededProductId}")) return fixed;
  const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
  const response = await request.get(`${apiURL}/products?size=1`);
  if (!response.ok()) {
    throw new Error(`Cannot resolve a seeded product: HTTP ${response.status()}`);
  }
  const payload: unknown = await response.json();
  const productId = productListSchema.parse(payload).data.content[0].id;
  return fixed.replace("{seededProductId}", encodeURIComponent(productId));
}
```

Treat this matrix as the locked target inventory. Plan 03 exports the resulting
route paths, and Plan 07 adds the blocking set-equality test after those route
composers exist. Any new or renamed buyer, seller, or admin route must then fail
until it declares persona, forced async states, and representative viewports
here.

- [ ] **Step 2: Write baseline journey tests**

Create `fe/e2e/baseline-commerce.spec.ts` with deterministic checks:

```ts
import { expect, test } from "@playwright/test";

import { resolveAcceptancePath } from "./fixtures/commerce-acceptance";

test("public buyer discovery reaches a product without layout overflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("phone");
  await page.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/\/search\?.*q=phone/);
  await expect(page.locator("main")).toBeVisible();

  const productPath = await resolveAcceptancePath(
    page.request,
    "/product/{seededProductId}",
  );
  await page.goto(productPath);
  await expect(page).toHaveURL(productPath);
  await expect(page.locator("main")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

test("protected checkout preserves the requested destination", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/);
});

test("buyer proxy records bounded discovery actions", async ({ page }, testInfo) => {
  let actions = 0;
  await page.goto("/");
  actions += 1;
  await page.getByRole("searchbox").fill("phone");
  await page.getByRole("searchbox").press("Enter");
  actions += 2;
  await expect(page.locator("main")).toBeVisible();
  expect(actions).toBeLessThanOrEqual(3);
  await testInfo.attach("journey-proxy", {
    body: JSON.stringify({ journey: "home-to-search", completed: true, actions }),
    contentType: "application/json",
  });
});
```

- [ ] **Step 3: Run the baseline journey against seeded services**

Run from repository root:

```powershell
docker compose --profile apps up -d
node infra/scripts/seed-demo.mjs
```

Run from `fe`:

```powershell
pnpm exec playwright test e2e/baseline-commerce.spec.ts --project=chromium
```

Expected: the discovery and redirect tests pass. Product paths are resolved from the seeded product API and decoded through Zod; no fixed database identifier or test-only production behavior is used.

- [ ] **Step 4: Implement route bundle measurement**

Set `build.manifest: true` in `fe/vite.config.ts`.

Create `fe/scripts/measure-route-bundles.mjs`:

```js
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valueAfter = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
};
const distDir = path.resolve(feDir, valueAfter("--dist", "dist"));
const distAssets = path.join(distDir, "assets");
const outputIndex = process.argv.indexOf("--output");
const output = path.resolve(
  feDir,
  outputIndex === -1
    ? "performance/baseline/route-bundles.json"
    : process.argv[outputIndex + 1],
);
const manifest = JSON.parse(
  await readFile(path.join(distDir, ".vite", "manifest.json"), "utf8"),
);

const files = (await readdir(distAssets)).filter((name) => name.endsWith(".js")).sort();
const assets = [];
const byName = new Map();
for (const name of files) {
  const body = await readFile(path.join(distAssets, name));
  const measured = {
    name,
    bytes: body.byteLength,
    gzipBytes: gzipSync(body).byteLength,
    sha256: createHash("sha256").update(body).digest("hex"),
  };
  assets.push(measured);
  byName.set(name, measured);
}

const routeEntries = {
  home: "src/app/pages/HomePage.tsx",
  search: "src/app/pages/SearchPage.tsx",
  product: "src/app/pages/ProductPage.tsx",
  cart: "src/app/pages/CartPage.tsx",
  checkout: "src/app/pages/checkout/index.ts",
};
const appEntries = Object.entries(manifest)
  .filter(([, output]) => output.isEntry)
  .map(([key]) => key);
if (appEntries.length !== 1) {
  throw new Error(`Expected one initial Vite entry, found ${appEntries.length}`);
}
const [appEntry] = appEntries;
function collect(entryKey, visited = new Set()) {
  if (visited.has(entryKey)) return visited;
  visited.add(entryKey);
  for (const imported of manifest[entryKey]?.imports ?? []) collect(imported, visited);
  return visited;
}
const routes = Object.fromEntries(
  Object.entries(routeEntries).map(([route, entry]) => {
    const entryKey = Object.keys(manifest).find((key) => key === entry);
    if (!entryKey) throw new Error(`Missing Vite manifest entry for ${entry}`);
    const reachable = new Set([...collect(appEntry), ...collect(entryKey)]);
    const routeAssets = [...reachable].flatMap((key) => {
      const file = manifest[key]?.file;
      if (!file) throw new Error(`Manifest key ${key} has no output file`);
      if (!file.endsWith(".js")) return [];
      const asset = byName.get(path.basename(file));
      if (!asset) throw new Error(`Manifest asset is missing from dist: ${file}`);
      return [asset];
    });
    return [
      route,
      {
        entry,
        assets: routeAssets.map((asset) => asset.name).sort(),
        gzipBytes: routeAssets.reduce((total, asset) => total + asset.gzipBytes, 0),
      },
    ];
  }),
);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify({ generatedFrom: path.relative(feDir, distDir), routes, assets }, null, 2)}\n`,
);
```

The optional `--dist <directory>` argument lets the final release gate measure
assets copied from the exact Docker image instead of assuming host `fe/dist`.
Missing assets, manifest entries, or flag values fail the command.

Create `measure-route-bundles.test.mjs` with a temporary synthetic manifest and
assets whose sole `isEntry` key is `index.html`, matching this project's
default Vite HTML input. Prove every route total includes that initial entry's
static graph plus its lazy route graph, shared assets are counted once, and
zero/multiple initial entries, a missing manifest file, or a missing on-disk
JavaScript asset fails instead of being filtered out.

Add:

```json
{
  "scripts": {
    "measure:bundles": "node scripts/measure-route-bundles.mjs"
  }
}
```

Run:

```powershell
node --test scripts/measure-route-bundles.test.mjs
pnpm run build
pnpm run measure:bundles
```

Expected: `fe/performance/baseline/route-bundles.json` lists every JavaScript asset with byte and gzip sizes.

- [ ] **Step 5: Install and implement three-run Lighthouse measurement**

Run from `fe`:

```powershell
pnpm add -D lighthouse@13.4.1 chrome-launcher@1.2.1
```

Create `fe/scripts/measure-lighthouse.mjs`:

```js
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { z } from "zod";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appURL = process.env.VITE_E2E_BASE_URL ?? "http://localhost:3000";
const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const buyerUsername = process.env.E2E_BUYER_USERNAME ?? "buyer1";
const buyerPassword = process.env.E2E_BUYER_PASSWORD ?? "test";
const outputIndex = process.argv.indexOf("--output");
const output = path.resolve(
  feDir,
  outputIndex === -1
    ? "performance/baseline/lighthouse-mobile.json"
    : process.argv[outputIndex + 1],
);
const values = [];
const chrome = await launch({ chromeFlags: ["--headless", "--no-sandbox"] });

try {
  const productResponse = await fetch(`${apiURL}/products?size=1`);
  if (!productResponse.ok) {
    throw new Error(`Cannot resolve a seeded product: HTTP ${productResponse.status}`);
  }
  const productPayload = z
    .object({
      data: z.object({
        content: z.array(z.object({ id: z.string().min(1) })).min(1),
      }),
    })
    .parse(await productResponse.json());
  const productPath = `/product/${encodeURIComponent(productPayload.data.content[0].id)}`;
  const routes = ["/", "/search?q=phone", productPath, "/cart", "/checkout"];

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Chrome did not expose a default browser context");
  const setupPage = await context.newPage();
  await setupPage.goto(`${appURL}/login`);
  await setupPage.locator("#username").fill(buyerUsername);
  await setupPage.locator("#password").fill(buyerPassword);
  await setupPage
    .getByRole("button", {
      name: /sign in|continue to sign in|\u0111\u0103ng nh\u1eadp/i,
    })
    .click();
  await setupPage.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await setupPage.goto(`${appURL}/cart`);
  const removeButtons = setupPage.getByRole("button", {
    name: /remove .* from cart|x\u00f3a .* gi\u1ecf/i,
  });
  const emptyCart = setupPage.getByRole("heading", {
    name: /cart is empty|gi\u1ecf h\u00e0ng tr\u1ed1ng/i,
  });
  await expect
    .poll(async () => (await removeButtons.count()) + (await emptyCart.count()))
    .toBeGreaterThan(0);
  for (let removed = 0; (await removeButtons.count()) > 0; removed += 1) {
    if (removed >= 100) throw new Error("Cart reset exceeded 100 items");
    await Promise.all([
      setupPage.waitForResponse(
        (response) =>
          response.url().includes("/cart/items/") &&
          response.request().method() === "DELETE" &&
          response.ok(),
      ),
      removeButtons.first().click(),
    ]);
  }
  await setupPage.goto(`${appURL}${productPath}`);
  const cartRequest = setupPage.waitForResponse(
    (response) =>
      response.url().includes("/cart/items") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await setupPage
    .getByRole("button", { name: /add to cart|th\u00eam v\u00e0o gi\u1ecf/i })
    .first()
    .click();
  await cartRequest;
  await setupPage.close();

  for (const route of routes) {
    const runs = [];
    for (let index = 0; index < 3; index += 1) {
      const result = await lighthouse(`${appURL}${route}`, {
        port: chrome.port,
        output: "json",
        onlyCategories: ["performance"],
        disableStorageReset: true,
        formFactor: "mobile",
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          requestLatencyMs: 150,
          downloadThroughputKbps: 1638.4,
          uploadThroughputKbps: 750,
          cpuSlowdownMultiplier: 4,
        },
      });
      const audits = result?.lhr.audits;
      if (!audits) throw new Error(`Lighthouse returned no audits for ${route}`);
      runs.push({
        lcpMs: audits["largest-contentful-paint"].numericValue,
        cls: audits["cumulative-layout-shift"].numericValue,
      });
    }
    const median = (items, key) => items.map((item) => item[key]).sort((a, b) => a - b)[1];
    const routeId =
      route === "/" ? "home"
      : route.startsWith("/search") ? "search"
      : route.startsWith("/product/") ? "product"
      : route.slice(1);
    values.push({
      route: routeId,
      url: route,
      runs,
      medianLcpMs: median(runs, "lcpMs"),
      medianCls: median(runs, "cls"),
    });
  }
} finally {
  await chrome.kill();
}

await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify({
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
    routes: values,
  }, null, 2)}\n`,
);
```

Add:

```json
{
  "scripts": {
    "measure:lighthouse": "node scripts/measure-lighthouse.mjs"
  }
}
```

- [ ] **Step 6: Record the Lighthouse baseline**

From the repository root, rebuild and start the production frontend container against the seeded stack:

```powershell
docker compose up -d --build frontend
Invoke-WebRequest -UseBasicParsing http://localhost:3000/healthz
```

Then run from `fe`:

```powershell
pnpm run measure:lighthouse
```

Expected: the production container health check passes. The script fails if
seeded products, buyer login, cart reset through the real remove-item UI, or
add-to-cart setup is unavailable. The recorded `cart` and `checkout` runs use
the same authenticated Chrome profile with exactly one real seeded item, while
`disableStorageReset` preserves that profile across Lighthouse runs.

Expected: `fe/performance/baseline/lighthouse-mobile.json` contains three runs and medians for all five routes. Keep raw numbers even when the current UI misses the target; later plans compare against evidence rather than an invented baseline.

- [ ] **Step 7: Write the baseline evidence report**

Create `docs/superpowers/reviews/2026-07-29-web-commerce-modernization-baseline.md` with:

```markdown
# Web Commerce Modernization Baseline

- Baseline source commit: output of `git rev-parse HEAD`
- Package manager: pnpm 9.15.9
- Runtime: React 19.2.8, Vite 7.3.6
- Typecheck: app, tests, and E2E pass
- ESLint: 0 errors; record the exact warning count
- Unit tests: record the exact passed-test count
- Production build: pass
- Bundle evidence: `fe/performance/baseline/route-bundles.json`
- Lighthouse evidence: `fe/performance/baseline/lighthouse-mobile.json`
- Buyer proxies: home-to-search completion, action count, checkout redirect preservation
- Known baseline defects: list only defects reproduced by the commands above
```

Replace each `record` instruction with the actual command result before committing. Do not estimate counts.

- [ ] **Step 8: Verify, review, and commit**

Run from `fe`:

```powershell
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
pnpm run measure:bundles
pnpm exec playwright test e2e/baseline-commerce.spec.ts --project=chromium
```

Use the master Review Gate, then commit:

```powershell
git add fe/e2e/fixtures/commerce-acceptance.ts fe/e2e/baseline-commerce.spec.ts fe/scripts/measure-route-bundles.mjs fe/scripts/measure-route-bundles.test.mjs fe/scripts/measure-lighthouse.mjs fe/vite.config.ts fe/package.json fe/pnpm-lock.yaml fe/performance/baseline/route-bundles.json fe/performance/baseline/lighthouse-mobile.json
git add -f docs/superpowers/reviews/2026-07-29-web-commerce-modernization-baseline.md
git commit -m "test(fe): record commerce modernization baseline"
```

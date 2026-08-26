import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

import { importSpecifiers, inspectImport, sourceFiles } from "./check-boundaries.mjs";

test("shared cannot import app or features", () => {
  assert.equal(
    inspectImport("src/shared/ui/button.tsx", "@/app/hooks/use-auth"),
    "shared must not import app or features",
  );
});

test("features cannot import app or another feature private file", () => {
  assert.equal(
    inspectImport("src/features/cart/model/cart-view.ts", "@/app/types/api"),
    "features must consume shared modules instead of app internals",
  );
  assert.equal(
    inspectImport(
      "src/features/cart/components/cart.tsx",
      "@/features/catalog/components/search-filters",
    ),
    "cross-feature imports must use the feature public index",
  );
  assert.equal(inspectImport("src/features/cart/components/cart.tsx", "@/features/catalog"), null);
  assert.equal(
    inspectImport(
      "src/features/reviews/components/reviews.tsx",
      "../../videos/components/VideoPlayer",
    ),
    "cross-feature imports must use the feature public index",
  );
  assert.equal(inspectImport("src/features/reviews/components/reviews.tsx", "../../videos"), null);
  assert.equal(
    inspectImport(
      "src/features/cart/components/cart.tsx",
      "@/features/cart/../catalog/components/private",
    ),
    "cross-feature imports must use the feature public index",
  );
});

test("app composition imports features only through public indexes", () => {
  assert.equal(inspectImport("src/app/routes.ts", "@/features/catalog"), null);
  assert.equal(
    inspectImport("src/app/routes.ts", "@/features/catalog/components/private"),
    "app must import features through their public index",
  );
  assert.equal(
    inspectImport("src/app/layouts/storefront-layout.tsx", "../../features/cart/model/private"),
    "app must import features through their public index",
  );
});

test("app cannot import legacy contract or client trees", () => {
  assert.equal(
    inspectImport("src/app/hooks/use-cart.ts", "../types/api"),
    "app must import shared contracts and APIs",
  );
  assert.equal(
    inspectImport("src/app/lib/api/endpoints/cart.ts", "../../../types/api"),
    "app must import shared contracts and APIs",
  );
  assert.equal(
    inspectImport("src/app/pages/CartPage.tsx", "@/app/lib/api/endpoints/cart"),
    "app must import shared contracts and APIs",
  );
  assert.equal(inspectImport("src/app/hooks/use-cart.ts", "@/shared/contracts/api"), null);
  assert.equal(inspectImport("src/app/hooks/use-cart.ts", "@/shared/api/endpoints/cart"), null);
});

test("finds static, side-effect, and dynamic imports", () => {
  assert.deepEqual(
    importSpecifiers(`
      import "@/shared/config";
      import { Button } from "@/shared/ui";
      const route = import("@/features/catalog");
    `),
    ["@/shared/config", "@/shared/ui", "@/features/catalog"],
  );
});

test("finds require calls and scans JavaScript-family files", async (t) => {
  assert.deepEqual(
    importSpecifiers(`
      const route = import("@/features/catalog");
      const legacy = require("@/app/lib/api/client");
      const view = <Widget />;
    `),
    ["@/features/catalog", "@/app/lib/api/client"],
  );

  const fixtureDir = await mkdtemp(path.join(tmpdir(), "vnshop-boundaries-"));
  t.after(() => rm(fixtureDir, { recursive: true, force: true }));
  await mkdir(path.join(fixtureDir, "src", "shared"), { recursive: true });
  await writeFile(
    path.join(fixtureDir, "src", "shared", "fixture.jsx"),
    'const client = require("@/app/lib/api/client");\nexport default client;\n',
  );
  assert.equal(sourceFiles(path.join(fixtureDir, "src")).length, 1);
});

test("CLI reports a violating JavaScript fixture", async (t) => {
  const fixtureDir = await mkdtemp(path.join(path.resolve("src/shared"), ".boundary-cli-"));
  t.after(() => rm(fixtureDir, { recursive: true, force: true }));
  await writeFile(
    path.join(fixtureDir, "fixture.js"),
    'require("../../app/hooks/use-auth");\n',
  );

  const checker = path.resolve("scripts/check-boundaries.mjs");
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [checker, path.resolve("src")], {
      cwd: path.resolve("."),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr }));
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /shared must not import app or features/);
});

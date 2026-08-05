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

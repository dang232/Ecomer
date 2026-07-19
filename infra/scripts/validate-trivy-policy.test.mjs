import assert from "node:assert/strict";
import test from "node:test";

import { validateTrivyPolicy } from "./validate-trivy-policy.mjs";

const now = new Date("2026-07-19T00:00:00.000Z");

test("accepts an empty exception policy", () => {
  assert.deepEqual(validateTrivyPolicy("vulnerabilities: []\n", now), []);
});

test("accepts a scoped, owned, short-lived exception", () => {
  const policy = `vulnerabilities:
  - id: CVE-2026-12345
    purls:
      - pkg:npm/example@1.0.0
    expired_at: 2026-08-10
    statement: \"@platform SEC-123 temporary exception\"
`;
  assert.deepEqual(validateTrivyPolicy(policy, now), []);
});

test("rejects global, unowned, or long-lived exceptions", () => {
  const policy = `vulnerabilities:
  - id: CVE-2026-12345
    expired_at: 2026-12-31
    statement: \"temporary\"
`;
  const errors = validateTrivyPolicy(policy, now);
  assert.ok(errors.some((error) => error.includes("next 30 days")));
  assert.ok(errors.some((error) => error.includes("owner and ticket")));
  assert.ok(errors.some((error) => error.includes("scoped")));
});

import assert from "node:assert/strict";
import test from "node:test";

import { buildProtectionPayload, validateProtection } from "./github-governance.mjs";

const common = {
  dismissStaleReviews: true,
  requireLastPushApproval: true,
  requireConversationResolution: true,
  requireLinearHistory: true,
  enforceAdmins: true,
  allowForcePushes: false,
  allowDeletions: false
};

const desired = {
  requiredChecks: ["CI Gate", "Analyze (java-kotlin)"],
  requiredApprovals: 1,
  requireCodeOwnerReviews: true
};

test("accepts protection that matches the policy", () => {
  const actual = {
    required_status_checks: {
      strict: true,
      checks: desired.requiredChecks.map((context) => ({ context }))
    },
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: true,
      required_approving_review_count: 1,
      require_last_push_approval: true,
      bypass_pull_request_allowances: { users: [], teams: [], apps: [] }
    },
    required_conversation_resolution: { enabled: true },
    required_linear_history: { enabled: true },
    enforce_admins: { enabled: true },
    allow_force_pushes: { enabled: false },
    allow_deletions: { enabled: false }
  };

  assert.deepEqual(validateProtection("production", desired, common, actual), []);
});

test("reports missing checks and bypass-capable protection", () => {
  const actual = {
    required_status_checks: { strict: false, checks: [] },
    required_pull_request_reviews: {
      dismiss_stale_reviews: false,
      require_code_owner_reviews: false,
      required_approving_review_count: 0,
      require_last_push_approval: false,
      bypass_pull_request_allowances: { users: [{ login: "promotion-bot" }] }
    },
    required_conversation_resolution: { enabled: false },
    required_linear_history: { enabled: false },
    enforce_admins: { enabled: false },
    allow_force_pushes: { enabled: true },
    allow_deletions: { enabled: true }
  };

  const errors = validateProtection("production", desired, common, actual);
  assert.ok(errors.some((error) => error.includes("missing required check CI Gate")));
  assert.ok(errors.some((error) => error.includes("require_code_owner_reviews")));
  assert.ok(errors.some((error) => error.includes("allow_force_pushes")));
  assert.ok(errors.some((error) => error.includes("bypass allowances")));
});

test("builds an update payload without bypass actors", () => {
  const payload = buildProtectionPayload(desired, common);

  assert.equal(payload.restrictions, null);
  assert.equal(payload.enforce_admins, true);
  assert.equal(payload.required_pull_request_reviews.require_code_owner_reviews, true);
  assert.deepEqual(payload.required_pull_request_reviews.bypass_pull_request_allowances, {
    users: [],
    teams: [],
    apps: []
  });
  assert.deepEqual(payload.required_status_checks.checks, [
    { context: "CI Gate" },
    { context: "Analyze (java-kotlin)" }
  ]);
});

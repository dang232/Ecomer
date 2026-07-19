import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function enabled(value) {
  return value === true || value?.enabled === true;
}

function reportedChecks(protection) {
  const statusChecks = protection.required_status_checks;
  if (!statusChecks) {
    return [];
  }
  if (Array.isArray(statusChecks.checks)) {
    return statusChecks.checks.map((check) => check.context);
  }
  return statusChecks.contexts ?? [];
}

export function validateProtection(branch, desired, common, actual) {
  const errors = [];
  const reviews = actual.required_pull_request_reviews;
  const actualChecks = new Set(reportedChecks(actual));

  if (!actual.required_status_checks?.strict) {
    errors.push(`${branch}: required status checks must be strict`);
  }
  for (const check of desired.requiredChecks) {
    if (!actualChecks.has(check)) {
      errors.push(`${branch}: missing required check ${check}`);
    }
  }
  if (!reviews) {
    errors.push(`${branch}: pull request reviews are not required`);
  } else {
    if ((reviews.required_approving_review_count ?? 0) < desired.requiredApprovals) {
      errors.push(`${branch}: requires fewer than ${desired.requiredApprovals} approvals`);
    }
    if (reviews.dismiss_stale_reviews !== common.dismissStaleReviews) {
      errors.push(`${branch}: dismiss_stale_reviews does not match policy`);
    }
    if (reviews.require_last_push_approval !== common.requireLastPushApproval) {
      errors.push(`${branch}: require_last_push_approval does not match policy`);
    }
    if (reviews.require_code_owner_reviews !== desired.requireCodeOwnerReviews) {
      errors.push(`${branch}: require_code_owner_reviews does not match policy`);
    }
    const bypass = reviews.bypass_pull_request_allowances ?? {};
    const bypassActors = [
      ...(bypass.users ?? []),
      ...(bypass.teams ?? []),
      ...(bypass.apps ?? [])
    ];
    if (bypassActors.length > 0) {
      errors.push(`${branch}: pull request bypass allowances must be empty`);
    }
  }

  const booleanRules = [
    ["required_conversation_resolution", common.requireConversationResolution],
    ["required_linear_history", common.requireLinearHistory],
    ["enforce_admins", common.enforceAdmins],
    ["allow_force_pushes", common.allowForcePushes],
    ["allow_deletions", common.allowDeletions]
  ];
  for (const [field, expected] of booleanRules) {
    if (enabled(actual[field]) !== expected) {
      errors.push(`${branch}: ${field} does not match policy`);
    }
  }

  return errors;
}

export function buildProtectionPayload(desired, common) {
  return {
    required_status_checks: {
      strict: true,
      checks: desired.requiredChecks.map((context) => ({ context }))
    },
    enforce_admins: common.enforceAdmins,
    required_pull_request_reviews: {
      dismiss_stale_reviews: common.dismissStaleReviews,
      require_code_owner_reviews: desired.requireCodeOwnerReviews,
      required_approving_review_count: desired.requiredApprovals,
      require_last_push_approval: common.requireLastPushApproval,
      bypass_pull_request_allowances: {
        users: [],
        teams: [],
        apps: []
      }
    },
    restrictions: null,
    required_linear_history: common.requireLinearHistory,
    allow_force_pushes: common.allowForcePushes,
    allow_deletions: common.allowDeletions,
    required_conversation_resolution: common.requireConversationResolution,
    lock_branch: false,
    allow_fork_syncing: true
  };
}

function ghJson(args, input) {
  const commandArgs = ["api", ...args];
  if (input) {
    commandArgs.push("--input", "-");
  }
  const output = execFileSync("gh", commandArgs, {
    encoding: "utf8",
    input: input ? JSON.stringify(input) : undefined,
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"]
  });
  return output.trim() ? JSON.parse(output) : {};
}

export function loadPolicy(policyPath) {
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  if (!/^1\./.test(policy.schemaVersion ?? "") || !policy.repository || !policy.branches || !policy.common) {
    throw new Error("invalid governance policy");
  }
  return policy;
}

function usage() {
  console.error("Usage: node infra/scripts/github-governance.mjs <check|apply> [policy-file]");
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const mode = process.argv[2];
  const policyPath = resolve(process.argv[3] ?? join(dirname(currentFile), "..", "governance", "branch-protection.json"));
  const policy = loadPolicy(policyPath);

  if (!new Set(["check", "apply"]).has(mode)) {
    usage();
    process.exitCode = 2;
  } else if (mode === "apply" && process.env.CONFIRM_GITHUB_BRANCH_PROTECTION !== policy.repository) {
    console.error(`Refusing to apply without CONFIRM_GITHUB_BRANCH_PROTECTION=${policy.repository}`);
    process.exitCode = 2;
  } else {
    const errors = [];
    for (const [branch, desired] of Object.entries(policy.branches)) {
      const endpoint = `repos/${policy.repository}/branches/${branch}/protection`;
      if (mode === "apply") {
        ghJson(["--method", "PUT", endpoint], buildProtectionPayload(desired, policy.common));
      }
      try {
        const actual = ghJson([endpoint]);
        errors.push(...validateProtection(branch, desired, policy.common, actual));
      } catch (error) {
        errors.push(`${branch}: unable to read branch protection (${error.status ?? error.message})`);
      }
    }

    if (errors.length > 0) {
      console.error("GitHub governance validation failed:");
      for (const error of errors) {
        console.error(`- ${error}`);
      }
      process.exitCode = 1;
    } else {
      console.log(`GitHub governance matches policy for ${policy.repository}.`);
    }
  }
}

import assert from "node:assert/strict";
import test from "node:test";

const {
  parseRequiredPersonas,
  validateReport,
} = await import("./assert-playwright-results.mjs");

function makeTest(title, overrides = {}) {
  return {
    title,
    projectName: "chromium",
    results: [{ status: "passed" }],
    ...overrides,
  };
}

function makeReport(tests) {
  return {
    suites: [
      {
        title: "e2e/modernization",
        specs: [
          {
            title: "modernization.spec.ts",
            tests,
          },
        ],
      },
    ],
  };
}

function makeSpec(title, tests) {
  return { title, tests };
}

function makeMultiSpecReport(specs) {
  return {
    suites: [
      {
        title: "e2e/modernization",
        specs,
      },
    ],
  };
}

test("passes a clean report", () => {
  const findings = validateReport(
    makeReport([
      makeTest("buyer journey"),
      makeTest("seller journey"),
      makeTest("admin journey"),
    ]),
  );

  assert.deepEqual(findings, []);
});

test("fails a malformed report", () => {
  const findings = validateReport({ suites: [{ specs: "broken" }] });
  assert.match(findings[0], /Malformed report/);
});

test("fails an empty report", () => {
  const findings = validateReport(makeReport([]));
  assert.match(findings[0], /zero tests/);
});

test("fails skipped, interrupted, and unexpected outcomes", () => {
  const findings = validateReport(
    makeReport([
      makeTest("skipped test", { results: [{ status: "skipped" }] }),
      makeTest("interrupted test", { results: [{ status: "interrupted" }] }),
      makeTest("unexpected test", { outcome: "unexpected" }),
    ]),
  );

  assert(findings.some((finding) => finding.includes("SKIPPED")));
  assert(findings.some((finding) => finding.includes("INTERRUPTED")));
  assert(findings.some((finding) => finding.includes("UNEXPECTED")));
});

test("fails failed reports and preserves error messages", () => {
  const findings = validateReport(
    makeReport([
      makeTest("admin queue", {
        results: [{ status: "failed", errors: [{ message: "element not found" }] }],
      }),
    ]),
  );

  assert(findings.some((finding) => finding.includes("FAILED")));
  assert(findings.some((finding) => finding.includes("element not found")));
});

test("fails unknown statuses", () => {
  const findings = validateReport(
    makeReport([makeTest("mystery test", { results: [{ status: "mystery" }] })]),
  );

  assert(findings.some((finding) => finding.includes("unknown status")));
});

test("fails duplicate titles within one project but allows cross-project duplicates", () => {
  const duplicateFindings = validateReport(
    makeReport([makeTest("same title"), makeTest("same title")]),
  );
  assert(duplicateFindings.some((finding) => finding.includes("Duplicate")));

  const crossProjectFindings = validateReport(
    makeReport([
      makeTest("shared title", { projectName: "chromium" }),
      makeTest("shared title", { projectName: "firefox" }),
    ]),
  );
  assert.deepEqual(crossProjectFindings, []);
});

test("fails when a test entry has no recorded status", () => {
  const findings = validateReport(
    makeReport([{ title: "half-written test", projectName: "chromium", results: [] }]),
  );

  assert(findings.some((finding) => finding.includes("no test results were recorded")));
});

test("parses required personas from explicit input", () => {
  assert.deepEqual(parseRequiredPersonas("buyer,seller"), ["buyer", "seller"]);
});

test("fails when a required persona is missing from the report via explicit config", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec("buyer.spec.ts", [makeTest("buyer journey")]),
      makeSpec("admin.spec.ts", [makeTest("admin journey")]),
    ]),
    { requiredPersonas: ["buyer", "seller", "admin"] },
  );

  assert(findings.some((finding) => finding.includes('Missing required personas: seller')));
});

test("fails when a required persona is missing from the report via env", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec("buyer.spec.ts", [makeTest("buyer journey")]),
      makeSpec("seller.spec.ts", [makeTest("seller journey")]),
    ]),
    { env: { E2E_REQUIRED_PERSONAS: "buyer,seller,admin" } },
  );

  assert(findings.some((finding) => finding.includes('Missing required personas: admin')));
});

test("passes when every required persona is present", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec("buyer.spec.ts", [makeTest("buyer journey")]),
      makeSpec("seller.spec.ts", [makeTest("seller journey")]),
      makeSpec("admin.spec.ts", [makeTest("admin journey")]),
    ]),
    { requiredPersonas: ["buyer", "seller", "admin"] },
  );

  assert.deepEqual(findings, []);
});

import assert from "node:assert/strict";
import test from "node:test";

const {
  inferCoveredPersonasFromSpecFiles,
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

function makeSpec(file, tests, title = file) {
  return { file, title, tests };
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

function makeNestedSuiteReport(suites) {
  return {
    suites: [
      {
        title: "e2e/modernization",
        suites,
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

test("passes a real Playwright-style report shape without test.title", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec(
        "e2e/modernization/buyer.spec.ts",
        [{ projectName: "chromium", status: "passed", results: [{ status: "passed" }] }],
        "buyer journey spec",
      ),
      makeSpec(
        "e2e/modernization/seller.spec.ts",
        [{ projectName: "chromium", status: "passed", results: [{ status: "passed" }] }],
        "seller journey spec",
      ),
      makeSpec(
        "e2e/modernization/admin.spec.ts",
        [{ projectName: "chromium", status: "passed", results: [{ status: "passed" }] }],
        "admin journey spec",
      ),
    ]),
    { requiredPersonas: ["buyer", "seller", "admin"] },
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

test("fails top-level unexpected status even when nested results say passed", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec("e2e/modernization/buyer.spec.ts", [
        {
          projectName: "chromium",
          status: "unexpected",
          results: [{ status: "passed" }],
        },
      ]),
    ]),
  );

  assert(findings.some((finding) => finding.includes("UNEXPECTED")));
});

test("fails unknown top-level status even when nested results say passed", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec("e2e/modernization/buyer.spec.ts", [
        {
          projectName: "chromium",
          status: "mystery",
          results: [{ status: "passed" }],
        },
      ]),
    ]),
  );

  assert(findings.some((finding) => finding.includes("unknown status: mystery")));
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

test("maps covered personas only from exact modernization spec paths", () => {
  assert.deepEqual(
    inferCoveredPersonasFromSpecFiles([
      "./e2e/modernization/buyer.spec.ts",
      "e2e\\modernization\\seller.spec.ts",
      ".\\e2e\\modernization\\admin.spec.ts",
      "e2e/modernization/cross-persona.spec.ts",
      "e2e/modernization/unknown.spec.ts",
      "e2e/other/buyer.spec.ts",
      "e2e\\other\\seller.spec.ts",
      "buyer.spec.ts",
    ]),
    ["buyer", "seller", "admin"],
  );

  assert.deepEqual(
    inferCoveredPersonasFromSpecFiles(["e2e/other/buyer.spec.ts", "e2e\\other\\seller.spec.ts"]),
    [],
  );
});

test("fails when a required persona is missing from the report via explicit config", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec("e2e/modernization/buyer.spec.ts", [makeTest("buyer journey")]),
      makeSpec("e2e/modernization/admin.spec.ts", [makeTest("admin journey")]),
    ]),
    { requiredPersonas: ["buyer", "seller", "admin"] },
  );

  assert(findings.some((finding) => finding.includes('Missing required personas: seller')));
});

test("fails when a required persona is missing from the report via env", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec("e2e/modernization/buyer.spec.ts", [makeTest("buyer journey")]),
      makeSpec("e2e/modernization/seller.spec.ts", [makeTest("seller journey")]),
    ]),
    { env: { E2E_REQUIRED_PERSONAS: "buyer,seller,admin" } },
  );

  assert(findings.some((finding) => finding.includes('Missing required personas: admin')));
});

test("passes when every required persona is present", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec("e2e/modernization/buyer.spec.ts", [makeTest("buyer journey")]),
      makeSpec("e2e/modernization/seller.spec.ts", [makeTest("seller journey")]),
      makeSpec("e2e/modernization/admin.spec.ts", [makeTest("admin journey")]),
    ]),
    { requiredPersonas: ["buyer", "seller", "admin"] },
  );

  assert.deepEqual(findings, []);
});

test("buyer spec titles mentioning seller do not satisfy required seller coverage", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec("e2e/modernization/buyer.spec.ts", [makeTest("buyer can message seller")]),
      makeSpec("e2e/modernization/admin.spec.ts", [makeTest("admin journey")]),
    ]),
    { requiredPersonas: ["buyer", "seller", "admin"] },
  );

  assert(findings.some((finding) => finding.includes("Missing required personas: seller")));
});

test("cross-persona spec satisfies all required personas by file identity", () => {
  const findings = validateReport(
    makeMultiSpecReport([
      makeSpec("e2e/modernization/cross-persona.spec.ts", [makeTest("handoff journey")]),
    ]),
    { requiredPersonas: ["buyer", "seller", "admin"] },
  );

  assert.deepEqual(findings, []);
});

test("uses full suite lineage for duplicate identity and diagnostics", () => {
  const sameLeafInDifferentSuites = validateReport(
    makeNestedSuiteReport([
      {
        title: "checkout",
        specs: [
          makeSpec(
            "e2e/modernization/buyer.spec.ts",
            [makeTest("same leaf")],
            "shared flow",
          ),
        ],
      },
      {
        title: "orders",
        specs: [
          makeSpec(
            "e2e/modernization/buyer.spec.ts",
            [makeTest("same leaf")],
            "shared flow",
          ),
        ],
      },
    ]),
  );
  assert.deepEqual(sameLeafInDifferentSuites, []);

  const duplicateFindings = validateReport(
    makeNestedSuiteReport([
      {
        title: "checkout",
        specs: [
          makeSpec(
            "e2e/modernization/buyer.spec.ts",
            [makeTest("same leaf"), makeTest("same leaf")],
            "shared flow",
          ),
        ],
      },
    ]),
  );
  assert(
    duplicateFindings.some((finding) =>
      finding.includes("e2e/modernization > checkout > shared flow > same leaf"),
    ),
  );
});

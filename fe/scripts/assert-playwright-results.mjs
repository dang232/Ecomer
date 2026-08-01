import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const testResultSchema = z
  .object({
    status: z.string(),
    errors: z
      .array(
        z.union([
          z.string(),
          z.object({
            message: z.string().optional(),
          }).passthrough(),
        ]),
      )
      .optional(),
  })
  .passthrough();

const testSchema = z
  .object({
    title: z.string().min(1),
    projectName: z.string().optional(),
    projectId: z.string().optional(),
    status: z.string().optional(),
    outcome: z.string().optional(),
    results: z.array(testResultSchema).optional(),
  })
  .passthrough();

const specSchema = z
  .object({
    title: z.string().optional(),
    tests: z.array(testSchema).optional(),
  })
  .passthrough();

const suiteSchema = z.lazy(() =>
  z
    .object({
      title: z.string().optional(),
      specs: z.array(specSchema).optional(),
      suites: z.array(suiteSchema).optional(),
    })
    .passthrough(),
);

const reportSchema = z
  .object({
    suites: z.array(suiteSchema),
  })
  .passthrough();

function collectTests(suite) {
  const tests = [];
  for (const spec of suite.specs ?? []) {
    tests.push(...(spec.tests ?? []));
  }
  for (const child of suite.suites ?? []) {
    tests.push(...collectTests(child));
  }
  return tests;
}

function statusLabelsForTest(test) {
  const statuses = [];

  for (const result of test.results ?? []) {
    statuses.push(result.status);
  }

  if (statuses.length === 0 && typeof test.status === "string") {
    statuses.push(test.status);
  }

  if (
    typeof test.outcome === "string" &&
    (test.outcome === "unexpected" || test.outcome === "skipped")
  ) {
    statuses.push(test.outcome);
  }

  return statuses;
}

function duplicateTitlesByProject(tests) {
  const seen = new Set();
  const duplicates = [];

  for (const test of tests) {
    const project = test.projectName ?? test.projectId ?? "default";
    const key = `${project}::${test.title}`;
    if (seen.has(key)) {
      duplicates.push(`${project}: ${test.title}`);
      continue;
    }
    seen.add(key);
  }

  return duplicates;
}

function errorMessages(errors = []) {
  return errors
    .map((error) => {
      if (typeof error === "string") {
        return error;
      }
      return error.message ?? JSON.stringify(error);
    })
    .filter(Boolean);
}

export function validateReport(report) {
  const parsed = reportSchema.safeParse(report);
  if (!parsed.success) {
    return [
      `Malformed report: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"} ${issue.message}`)
        .join("; ")}`,
    ];
  }

  const tests = parsed.data.suites.flatMap(collectTests);
  if (tests.length === 0) {
    return ["Report contains zero tests - the selected suite did not run."];
  }

  const findings = [];
  const duplicates = duplicateTitlesByProject(tests);
  if (duplicates.length > 0) {
    findings.push(`Duplicate test titles found: ${duplicates.join(", ")}`);
  }

  for (const test of tests) {
    const statuses = statusLabelsForTest(test);
    if (statuses.length === 0) {
      findings.push(`Malformed report entry for "${test.title}" - no test results were recorded.`);
      continue;
    }

    for (const status of statuses) {
      switch (status) {
        case "passed":
        case "expected":
          break;
        case "failed":
        case "timedOut":
          findings.push(`Test "${test.title}" FAILED with status ${status}.`);
          for (const message of errorMessages(test.results?.flatMap((result) => result.errors ?? []))) {
            findings.push(`  ${message}`);
          }
          break;
        case "skipped":
          findings.push(`Test "${test.title}" was SKIPPED.`);
          break;
        case "interrupted":
          findings.push(`Test "${test.title}" was INTERRUPTED.`);
          break;
        case "unexpected":
          findings.push(`Test "${test.title}" had an UNEXPECTED outcome.`);
          break;
        default:
          findings.push(`Test "${test.title}" has unknown status: ${status}`);
          break;
      }
    }
  }

  return findings;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) {
    console.error("Usage: node scripts/assert-playwright-results.mjs <json-report-path>");
    process.exit(1);
  }

  const reportPath = path.resolve(argv[0]);
  let raw;
  try {
    raw = await readFile(reportPath, "utf8");
  } catch (error) {
    console.error(`Could not read report file: ${error.message}`);
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error("Report file is not valid JSON");
    process.exit(1);
  }

  const findings = validateReport(report);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(finding);
    }
    process.exit(1);
  }

  console.log(`Playwright report ${reportPath} is clean.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const personaSchema = z.enum(["buyer", "seller", "admin"]);

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
    title: z.string().min(1).optional(),
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
    file: z.string().optional(),
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

function collectTests(suite, lineage = []) {
  const tests = [];
  const nextLineage = suite.title ? [...lineage, suite.title] : lineage;
  for (const spec of suite.specs ?? []) {
    const specLineage = spec.title ? [...nextLineage, spec.title] : nextLineage;
    for (const test of spec.tests ?? []) {
      tests.push({
        test,
        titlePath: specLineage,
        specFile: spec.file,
        specTitle: spec.title,
      });
    }
  }
  for (const child of suite.suites ?? []) {
    tests.push(...collectTests(child, nextLineage));
  }
  return tests;
}

function statusLabelsForTest(test) {
  const statuses = new Set();

  for (const result of test.results ?? []) {
    statuses.add(result.status);
  }

  if (typeof test.status === "string") {
    statuses.add(test.status);
  }

  if (typeof test.outcome === "string") {
    statuses.add(test.outcome);
  }

  return [...statuses];
}

function testIdentity({ test, titlePath, specFile, specTitle }) {
  const specIdentity = specFile ?? specTitle ?? "<unknown spec>";
  const leafTitle = test.title ?? specTitle ?? specFile ?? "<unnamed test>";
  const fullTitlePath = [...titlePath];
  if (fullTitlePath.at(-1) !== leafTitle) {
    fullTitlePath.push(leafTitle);
  }
  const titlePathIdentity = fullTitlePath.join(" > ") || leafTitle;

  return {
    specIdentity,
    testIdentity: leafTitle,
    titlePath: fullTitlePath,
    full: `${specIdentity} :: ${titlePathIdentity}`,
  };
}

function duplicateTitlesByProject(tests) {
  const seen = new Set();
  const duplicates = [];

  for (const entry of tests) {
    const { test } = entry;
    const project = test.projectName ?? test.projectId ?? "default";
    const identity = testIdentity(entry);
    const key = `${project}::${identity.full}`;
    if (seen.has(key)) {
      duplicates.push(`${project}: ${identity.full}`);
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

export function parseRequiredPersonas(input) {
  if (input === undefined) {
    return [];
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Required personas input must contain at least one persona when provided.");
  }

  const unique = new Set();
  for (const rawPersona of trimmed.split(",")) {
    unique.add(personaSchema.parse(rawPersona.trim()));
  }
  return [...unique];
}

const modernizationPersonasBySpecPath = new Map([
  ["e2e/modernization/buyer.spec.ts", ["buyer"]],
  ["e2e/modernization/seller.spec.ts", ["seller"]],
  ["e2e/modernization/admin.spec.ts", ["admin"]],
  ["e2e/modernization/cross-persona.spec.ts", ["buyer", "seller", "admin"]],
]);

function personasForSpecFile(specFile) {
  if (typeof specFile !== "string") {
    return [];
  }

  const normalized = specFile.replace(/\\/g, "/").replace(/^\.\/+/, "");
  return modernizationPersonasBySpecPath.get(normalized) ?? [];
}

function inferCoveredPersonas(tests) {
  const covered = new Set();

  for (const { specFile } of tests) {
    for (const persona of personasForSpecFile(specFile)) {
      covered.add(persona);
    }
  }

  return covered;
}

export function inferCoveredPersonasFromSpecFiles(specFiles) {
  const covered = new Set();
  for (const specFile of specFiles) {
    for (const persona of personasForSpecFile(specFile)) {
      covered.add(persona);
    }
  }

  return [...covered];
}

export function validateReport(report, options = {}) {
  const parsed = reportSchema.safeParse(report);
  if (!parsed.success) {
    return [
      `Malformed report: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"} ${issue.message}`)
        .join("; ")}`,
    ];
  }

  const tests = parsed.data.suites.flatMap((suite) => collectTests(suite));
  if (tests.length === 0) {
    return ["Report contains zero tests - the selected suite did not run."];
  }

  const findings = [];
  const requiredPersonas =
    options.requiredPersonas ??
    parseRequiredPersonas(options.env?.E2E_REQUIRED_PERSONAS ?? process.env.E2E_REQUIRED_PERSONAS);
  const coveredPersonas = inferCoveredPersonas(tests);
  const missingPersonas = requiredPersonas.filter((persona) => !coveredPersonas.has(persona));

  if (missingPersonas.length > 0) {
    findings.push(`Missing required personas: ${missingPersonas.join(", ")}`);
  }

  const duplicates = duplicateTitlesByProject(tests);
  if (duplicates.length > 0) {
    findings.push(`Duplicate test titles found: ${duplicates.join(", ")}`);
  }

  for (const entry of tests) {
    const { test } = entry;
    const identity = testIdentity(entry);
    const statuses = statusLabelsForTest(test);
    if (statuses.length === 0) {
      findings.push(
        `Malformed report entry for "${identity.full}" - no test results were recorded.`,
      );
      continue;
    }

    for (const status of statuses) {
      switch (status) {
        case "passed":
        case "expected":
          break;
        case "failed":
        case "timedOut":
          findings.push(`Test "${identity.full}" FAILED with status ${status}.`);
          for (const message of errorMessages(test.results?.flatMap((result) => result.errors ?? []))) {
            findings.push(`  ${message}`);
          }
          break;
        case "skipped":
          findings.push(`Test "${identity.full}" was SKIPPED.`);
          break;
        case "interrupted":
          findings.push(`Test "${identity.full}" was INTERRUPTED.`);
          break;
        case "unexpected":
          findings.push(`Test "${identity.full}" had an UNEXPECTED outcome.`);
          break;
        default:
          findings.push(`Test "${identity.full}" has unknown status: ${status}`);
          break;
      }
    }
  }

  return findings;
}

async function main(argv = process.argv.slice(2)) {
  let requiredPersonas;
  const reportArgs = [];

  for (const arg of argv) {
    if (arg.startsWith("--required-personas=")) {
      requiredPersonas = parseRequiredPersonas(arg.slice("--required-personas=".length));
      continue;
    }
    reportArgs.push(arg);
  }

  if (reportArgs.length !== 1) {
    console.error(
      "Usage: node scripts/assert-playwright-results.mjs [--required-personas=buyer,seller,admin] <json-report-path>",
    );
    process.exit(1);
  }

  const reportPath = path.resolve(reportArgs[0]);
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

  const findings = validateReport(report, { requiredPersonas });
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

#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SOURCE_EXTENSIONS = new Set([".java", ".ts", ".tsx", ".py"]);
const IGNORED_SEGMENTS = new Set([
  ".git",
  "node_modules",
  "target",
  "dist",
  "build",
  "coverage",
  "e2e",
  "test",
  "tests",
  "__tests__",
]);

function usageError(message) {
  throw new Error(`${message}\nusage: node scripts/check-quality-constraints.mjs [--max-loc N] [--reject-generic-catches] [--source-root DIR ...]`);
}

function parseArgs(argv) {
  const options = { maxLoc: 250, rejectGenericCatches: false, sourceRoots: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--max-loc") {
      const value = Number(argv[++index]);
      if (!Number.isInteger(value) || value < 1) usageError("--max-loc requires a positive integer");
      options.maxLoc = value;
    } else if (argument === "--reject-generic-catches") {
      options.rejectGenericCatches = true;
    } else if (argument === "--source-root") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) usageError("--source-root requires a directory");
      options.sourceRoots.push(value);
    } else {
      usageError(`unknown argument: ${argument}`);
    }
  }
  if (options.sourceRoots.length === 0) options.sourceRoots.push("services", "fe");
  return options;
}

async function sourceFiles(directory, root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORED_SEGMENTS.has(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(filename, root));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !/(?:\.test|\.spec)\.[^.]+$/.test(entry.name)) {
      files.push({ filename, relative: path.relative(root, filename).replaceAll(path.sep, "/") });
    }
  }
  return files;
}

function pureLoc(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return trimmed !== "" && !trimmed.startsWith("//") && !trimmed.startsWith("#") && !trimmed.startsWith("--");
  }).length;
}

function genericCatchLines(source) {
  const lines = source.split(/\r?\n/);
  const findings = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/\bcatch\s*\(\s*(?:java\.lang\.)?(?:Exception|RuntimeException)\b/.test(lines[index])) {
      findings.push(index + 1);
    }
  }
  return findings;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repo = process.cwd();
  const files = [];
  for (const configuredRoot of options.sourceRoots) {
    const root = path.resolve(repo, configuredRoot);
    const entries = await sourceFiles(root, root);
    files.push(...entries.map((entry) => ({ ...entry, display: path.relative(repo, entry.filename).replaceAll(path.sep, "/") })));
  }

  const violations = [];
  let genericCatchCount = 0;
  for (const file of files.sort((left, right) => left.display.localeCompare(right.display))) {
    const source = await readFile(file.filename, "utf8");
    const loc = pureLoc(source);
    if (loc > options.maxLoc) violations.push(`${file.display}: pure LOC ${loc} exceeds max ${options.maxLoc}`);
    if (options.rejectGenericCatches && path.extname(file.filename) === ".java") {
      for (const line of genericCatchLines(source)) {
        genericCatchCount += 1;
        violations.push(`${file.display}:${line}: generic catch of Exception/RuntimeException`);
      }
    }
  }

  if (violations.length > 0) {
    console.error("QUALITY CONSTRAINTS FAILED");
    console.error(violations.join("\n"));
    console.error(`SUMMARY files=${files.length} oversized=${violations.filter((finding) => finding.includes("pure LOC")).length} genericCatches=${genericCatchCount}`);
    process.exitCode = 1;
    return;
  }
  console.log(`QUALITY CONSTRAINTS PASSED (files=${files.length}, maxPureLoc=${options.maxLoc}, genericCatches=${genericCatchCount})`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}

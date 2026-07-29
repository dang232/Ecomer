#!/usr/bin/env node
// Hydrate any OneDrive "Files On-Demand" reparse-points in fe/e2e/.
//
// Why: OneDrive's cloud-only stubs report `IO_REPARSE_TAG_CLOUD` and
// Playwright's file walker on Windows silently excludes them from
// `testMatch`. Symptoms: `npx playwright test --list` shows N-2 of N
// specs and targeting a missing spec by exact path returns
// "Total: 0 tests in 0 files".
//
// Fix: copy → delete → rename forces the file out of the reparse-point
// table and into a plain on-disk file. Reading alone is not enough —
// OneDrive can re-evict after a sync cycle.
//
// On non-Windows this script is a no-op.

import {
  copyFileSync,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "e2e");

const REPARSE_POINT = 0x400; // IO_REPARSE_TAG_* set on file attributes via fs

export function collectSpecFiles(directory) {
  const specs = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    const stat = lstatSync(full);
    const targetStat = stat.isSymbolicLink() ? statSync(full) : stat;
    if (targetStat.isDirectory()) {
      specs.push(...collectSpecFiles(full));
      continue;
    }
    if (entry.name.endsWith(".spec.ts")) specs.push(full);
  }
  return specs.sort();
}

function hydrateSpecFile(full) {
  try {
    readFileSync(full);
  } catch (error) {
    throw new Error(`Could not read E2E spec: ${full}`, { cause: error });
  }

  const stat = lstatSync(full);
  // Node's lstat sets isSymbolicLink() for reparse-points on Windows;
  // OneDrive cloud-only stubs come through here.
  if (!stat.isSymbolicLink()) return false;
  const tmp = `${full}.hydrate.tmp`;
  copyFileSync(full, tmp);
  unlinkSync(full);
  renameSync(tmp, full);
  return true;
}

function main() {
  if (process.platform !== "win32" || !existsSync(E2E_DIR)) return;

  let hydrated = 0;
  for (const spec of collectSpecFiles(E2E_DIR)) {
    if (hydrateSpecFile(spec)) hydrated += 1;
  }

  if (hydrated > 0) {
    console.log(`hydrated ${hydrated} OneDrive reparse-point spec file(s) in fe/e2e/`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

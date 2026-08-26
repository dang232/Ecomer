#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), '..');
const expectedTaskCount = 32;
const taskRow = /^- \[([ xX])\] (\d+)\. (.+)$/;
const topLevelCheckbox = /^- \[[ xX]\] /i;
const finalRow = /^- \[[ xX]\] F[1-4]\. /i;
const requiredEvidence = (id) => `.omo/evidence/vnshop-deep-fix/task-${id}-vnshop-deep-fix.log`;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function blockFor(rows, index, lines) {
  const start = rows[index].line;
  const end = rows[index + 1]?.line ?? lines.length;
  return lines.slice(start, end).join('\n');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const planPath = process.argv[2];
  if (!planPath) throw new Error('usage: node scripts/verify-plan.mjs <plan-path>');

  const absolutePlan = resolve(planPath);
  const source = await readFile(absolutePlan, 'utf8');
  const lines = source.split(/\r?\n/);
  const rows = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(taskRow);
    if (match) rows.push({ line: index, id: Number(match[2]), checked: match[1].toLowerCase() === 'x', title: match[3] });
  }

  const errors = [];
  if (rows.length !== expectedTaskCount) errors.push(`expected exactly ${expectedTaskCount} top-level implementation todos, found ${rows.length}`);
  const expectedIds = Array.from({ length: expectedTaskCount }, (_, index) => index + 1);
  const actualIds = rows.map((row) => row.id);
  if (actualIds.some((id, index) => id !== expectedIds[index])) errors.push(`top-level todo numbers must be exactly 1..${expectedTaskCount}, found ${actualIds.join(',')}`);

  for (const [index, row] of rows.entries()) {
    const block = blockFor(rows, index, lines);
    const metadata = [
      ['References', /\bReferences(?: \([^\n]+\))?:\s*\S+/i],
      ['Acceptance criteria', /\bAcceptance criteria(?: \([^\n]+\))?:\s*\S+/i],
      ['QA scenarios', /\bQA scenarios(?: \([^\n]+\))?:\s*[\s\S]*\bhappy:/i],
      ['failure QA scenario', /\bQA scenarios(?: \([^\n]+\))?:[\s\S]*\bfailure:/i],
      ['Parallelization wave', /\bParallelization:\s*Wave\s+\d+/i],
      ['Blocked by metadata', /\bBlocked by:/i],
      ['Blocks metadata', /\bBlocks:/i],
      ['Must NOT constraint', /\bMust NOT\s+(?:do|have|keep|use|add|leave|be):/i],
      ['Commit metadata', /\bCommit:\s*[YN]\s*\|/i],
    ];
    for (const [label, pattern] of metadata) if (!pattern.test(block)) errors.push(`todo ${row.id}: missing ${label}`);

    const evidencePath = requiredEvidence(row.id);
    if (!block.includes(evidencePath)) errors.push(`todo ${row.id}: missing canonical evidence path ${evidencePath}`);
    const evidenceFile = resolve(repoRoot, evidencePath);
    if (!(await exists(evidenceFile))) errors.push(`todo ${row.id}: canonical evidence file is missing at ${evidencePath}`);
    if (!row.checked) errors.push(`todo ${row.id}: implementation row is not checked`);
  }

  const nestedOrOtherRows = lines.filter((line) => topLevelCheckbox.test(line) && !taskRow.test(line) && !finalRow.test(line));
  if (nestedOrOtherRows.length > 0) errors.push(`found ${nestedOrOtherRows.length} top-level checkbox rows outside implementation todo format`);

  console.log(`PLAN: ${absolutePlan}`);
  console.log(`TOP_LEVEL_TODOS: ${rows.length}/${expectedTaskCount}`);
  console.log(`CHECKED: ${rows.filter((row) => row.checked).length}/${rows.length}`);
  const evidenceResults = await Promise.all(rows.map((row) => exists(resolve(repoRoot, requiredEvidence(row.id)))));
  console.log(`CANONICAL_EVIDENCE: ${evidenceResults.filter(Boolean).length}/${rows.length}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    fail(`plan verification found ${errors.length} issue(s)`);
    return;
  }
  console.log('PASS: plan structure, metadata, completion, and canonical evidence are complete');
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});

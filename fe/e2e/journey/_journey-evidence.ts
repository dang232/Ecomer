import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readJourneyState } from "./_journey-state";
export { expectNoGlobalError } from "../_helpers";

/**
 * Evidence + reporting helper for the BA-grade journey suite.
 *
 * Differences from fe/e2e/_workday-evidence.ts (which the persona-workday
 * specs use):
 *   - Steps carry an Acceptance Criterion code (`AC-2.2`) and a
 *     business-language outcome instead of a click-level title.
 *   - REPORT.md per chapter renders an "Acceptance Criteria" table at the
 *     top so a BA can read pass/fail per outcome without scrolling
 *     through screenshots.
 *   - A separate aggregateJourneyReport() walks every chapter folder and
 *     produces fe/e2e/evidence/JOURNEY-REPORT.md — the stakeholder
 *     artifact.
 *
 * Layout produced:
 *
 *   fe/e2e/evidence/journey/
 *   ├── 01-admin-onboards/
 *   │   ├── REPORT.md
 *   │   └── screenshots/NN-slug.png
 *   ├── 02-buyer-orders/
 *   │   └── ...
 *   ├── state.json
 *   └── (top-level fe/e2e/evidence/JOURNEY-REPORT.md aggregates all)
 */

export type ChapterId =
  | "01-admin-onboards"
  | "02-buyer-orders"
  | "03-seller-fulfills"
  | "04-buyer-reviews"
  | "05-seller-cashes-out"
  | "06-admin-closes-loop";

export interface ChapterMeta {
  id: ChapterId;
  title: string;
  persona: "admin" | "buyer" | "seller";
  acceptanceCriteria: ReadonlyArray<{ code: string; outcome: string }>;
}

export interface BizStepRow {
  index: number;
  acCode: string;
  outcome: string;
  slug: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  errorMessage?: string;
}

const counters: Record<string, number> = {};
const reports: Record<string, BizStepRow[]> = {};
const metas: Record<string, ChapterMeta> = {};

const evidenceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "evidence",
  "journey",
);

function chapterDir(id: ChapterId): string {
  return path.join(evidenceRoot, id);
}

function shotDir(id: ChapterId): string {
  return path.join(chapterDir(id), "screenshots");
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "step"
  );
}

export async function startChapter(meta: ChapterMeta): Promise<void> {
  metas[meta.id] = meta;
  counters[meta.id] = 0;
  reports[meta.id] = [];
  await fs.rm(shotDir(meta.id), { recursive: true, force: true });
  await fs.mkdir(shotDir(meta.id), { recursive: true });
}

/**
 * Wraps Playwright's test.step():
 *   - Increments the chapter's step counter
 *   - Tags the row with the AC code and business outcome
 *   - Captures a numbered fullPage screenshot
 *   - Marks BLOCKED if the body throws a "journey state missing" error
 *     (so REPORT.md distinguishes "the platform broke" from "a previous
 *     chapter didn't run")
 */
export async function bizStep(
  page: Page,
  chapterId: ChapterId,
  acCode: string,
  outcome: string,
  fn: () => Promise<void>,
): Promise<void> {
  counters[chapterId] += 1;
  const index = counters[chapterId];
  const slug = slugify(`${acCode}-${outcome}`);
  const indexStr = index.toString().padStart(2, "0");
  const filename = `${indexStr}-${slug}.png`;
  const screenshotPath = path.join(shotDir(chapterId), filename);

  await test.step(`[${chapterId}/${indexStr}] ${acCode} — ${outcome}`, async () => {
    let failure: Error | undefined;
    let blocked = false;
    try {
      await fn();
    } catch (err) {
      failure = err instanceof Error ? err : new Error(String(err));
      if (/journey state missing required keys/i.test(failure.message)) {
        blocked = true;
      }
    }
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch {
      /* page closed — slug already recorded */
    }
    reports[chapterId].push({
      index,
      acCode,
      outcome,
      slug: filename,
      status: failure ? (blocked ? "BLOCKED" : "FAIL") : "PASS",
      errorMessage: failure?.message,
    });
    if (failure) throw failure;
  });
}

export async function startTrace(chapterId: ChapterId, page: Page): Promise<void> {
  await fs.mkdir(chapterDir(chapterId), { recursive: true });
  try {
    await page.context().tracing.start({
      screenshots: false,
      snapshots: true,
      sources: true,
      title: `journey-${chapterId}`,
    });
  } catch {
    /* trace already running */
  }
}

export async function stopTrace(chapterId: ChapterId, page: Page): Promise<void> {
  const dest = path.join(chapterDir(chapterId), "trace.zip");
  try {
    await page.context().tracing.stop({ path: dest });
  } catch {
    /* no active trace */
  }
}

const pendingOutputDirs: Record<string, string[]> = {};

export function rememberOutputDir(chapterId: ChapterId, testInfo: TestInfo): void {
  pendingOutputDirs[chapterId] ??= [];
  pendingOutputDirs[chapterId].push(testInfo.outputDir);
}

export async function copyArtifacts(chapterId: ChapterId): Promise<void> {
  const dest = chapterDir(chapterId);
  await fs.mkdir(dest, { recursive: true });
  for (const outputDir of pendingOutputDirs[chapterId] ?? []) {
    const src = path.join(outputDir, "video.webm");
    try {
      await fs.copyFile(src, path.join(dest, "video.webm"));
    } catch {
      /* video unavailable */
    }
  }
}

interface AcStatus {
  code: string;
  outcome: string;
  status: "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";
  failingStep?: BizStepRow;
}

/**
 * For each declared AC, finds all rows that touched it and rolls them up:
 *   - any FAIL row → AC FAIL
 *   - any BLOCKED row (and no FAIL) → AC BLOCKED
 *   - all PASS rows → AC PASS
 *   - no rows touched it → AC NOT_RUN (means the chapter forgot the AC)
 */
function rollupAcStatuses(meta: ChapterMeta, rows: BizStepRow[]): AcStatus[] {
  return meta.acceptanceCriteria.map((ac) => {
    const touching = rows.filter((r) => r.acCode === ac.code);
    if (touching.length === 0) {
      return { code: ac.code, outcome: ac.outcome, status: "NOT_RUN" };
    }
    const failing = touching.find((r) => r.status === "FAIL");
    if (failing) {
      return { code: ac.code, outcome: ac.outcome, status: "FAIL", failingStep: failing };
    }
    const blocked = touching.find((r) => r.status === "BLOCKED");
    if (blocked) {
      return { code: ac.code, outcome: ac.outcome, status: "BLOCKED", failingStep: blocked };
    }
    return { code: ac.code, outcome: ac.outcome, status: "PASS" };
  });
}

export async function finalizeChapterReport(chapterId: ChapterId): Promise<void> {
  const meta = metas[chapterId];
  // Defensive: if a chapter's `startChapter` never ran (e.g. beforeAll
  // crashed before recording the meta), fall back to a stub so the
  // sidecar still lands. Without this guard, a chapter that fails very
  // early would be invisible in the JOURNEY-REPORT.
  const safeMeta: ChapterMeta = meta ?? {
    id: chapterId,
    title: chapterId,
    persona: "buyer",
    acceptanceCriteria: [],
  };
  const rows = reports[chapterId] ?? [];
  const acStatuses = rollupAcStatuses(safeMeta, rows);

  const verdict = acStatuses.some((a) => a.status === "FAIL")
    ? "FAIL"
    : acStatuses.some((a) => a.status === "BLOCKED")
      ? "BLOCKED"
      : acStatuses.length > 0 && acStatuses.every((a) => a.status === "PASS")
        ? "PASS"
        : rows.some((r) => r.status === "FAIL")
          ? "FAIL"
          : "PARTIAL";

  await fs.mkdir(chapterDir(chapterId), { recursive: true });

  const lines: string[] = [];
  lines.push(`# ${safeMeta.title}`);
  lines.push("");
  lines.push(`**Persona:** ${safeMeta.persona}`);
  lines.push(`**Verdict:** ${verdict}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Business outcomes verified");
  lines.push("");
  lines.push("| AC | Outcome | Status |");
  lines.push("|---|---|---|");
  for (const a of acStatuses) {
    lines.push(`| ${a.code} | ${a.outcome} | ${a.status} |`);
  }
  lines.push("");
  lines.push("## Stakeholder summary");
  lines.push("");
  lines.push(stakeholderSummary(safeMeta, acStatuses));
  lines.push("");
  lines.push("## Steps (engineer view)");
  lines.push("");
  for (const r of rows) {
    const indexStr = r.index.toString().padStart(2, "0");
    lines.push(`### ${indexStr}. ${r.acCode} — ${r.outcome} — ${r.status}`);
    lines.push("");
    lines.push(`![${r.outcome}](screenshots/${r.slug})`);
    lines.push("");
    if (r.errorMessage) {
      lines.push("```");
      lines.push(r.errorMessage);
      lines.push("```");
      lines.push("");
    }
  }
  lines.push("## Artifacts");
  lines.push("");
  lines.push("- `trace.zip` — open with `npx playwright show-trace trace.zip`");
  lines.push("- `video.webm` — full session recording (gitignored)");
  lines.push("- `screenshots/` — one `NN-slug.png` per step, regenerated each run");

  await fs.writeFile(
    path.join(chapterDir(chapterId), "REPORT.md"),
    `${lines.join("\n")}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(chapterDir(chapterId), "report.json"),
    `${JSON.stringify({ meta: safeMeta, rows, acStatuses, verdict, generatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
}

function stakeholderSummary(meta: ChapterMeta, acs: AcStatus[]): string {
  const passed = acs.filter((a) => a.status === "PASS").length;
  const total = acs.length;
  if (passed === total) {
    return `All ${total} acceptance criteria verified for the ${meta.persona} flow. No business-rule regressions detected this run.`;
  }
  const failed = acs.filter((a) => a.status === "FAIL");
  const blocked = acs.filter((a) => a.status === "BLOCKED");
  const parts: string[] = [];
  parts.push(`${passed} of ${total} acceptance criteria passed for the ${meta.persona} flow.`);
  if (failed.length > 0) {
    parts.push(`Failed: ${failed.map((a) => `${a.code} (${a.outcome})`).join("; ")}.`);
  }
  if (blocked.length > 0) {
    parts.push(
      `Blocked: ${blocked.map((a) => `${a.code} — ${a.failingStep?.errorMessage ?? "predecessor chapter did not run"}`).join("; ")}.`,
    );
  }
  return parts.join(" ");
}

/**
 * Aggregate every chapter's report.json sidecar into a single stakeholder
 * artifact at fe/e2e/evidence/JOURNEY-REPORT.md. Reads from disk so it
 * works regardless of which chapter invocation happened to be last in
 * memory — partial runs still produce a useful report.
 */
export async function aggregateJourneyReport(): Promise<void> {
  const aggregateDest = path.resolve(evidenceRoot, "..", "JOURNEY-REPORT.md");

  const orderedIds: ChapterId[] = [
    "01-admin-onboards",
    "02-buyer-orders",
    "03-seller-fulfills",
    "04-buyer-reviews",
    "05-seller-cashes-out",
    "06-admin-closes-loop",
  ];

  interface OnDiskReport {
    meta: ChapterMeta;
    rows: BizStepRow[];
    acStatuses: AcStatus[];
    verdict: "PASS" | "FAIL" | "BLOCKED" | "PARTIAL";
    generatedAt: string;
  }

  const found: Array<{ chapterId: ChapterId; report: OnDiskReport }> = [];
  for (const id of orderedIds) {
    const sidecar = path.join(chapterDir(id), "report.json");
    try {
      const raw = await fs.readFile(sidecar, "utf8");
      found.push({ chapterId: id, report: JSON.parse(raw) as OnDiskReport });
    } catch {
      // Chapter didn't run this invocation — skip silently.
    }
  }

  const lines: string[] = [];
  lines.push("# VNShop Journey — End-to-End Business Outcome Report");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    "This report aggregates every chapter of the BA-grade persona journey. Each row is a single business outcome the platform must support; columns map to the chapter and persona that exercises it.",
  );
  lines.push("");

  if (found.length === 0) {
    lines.push("**No chapters ran. Run the journey suite to populate this report.**");
    await fs.mkdir(path.dirname(aggregateDest), { recursive: true });
    await fs.writeFile(aggregateDest, `${lines.join("\n")}\n`, "utf8");
    return;
  }

  const allAcs = found.flatMap((f) => f.report.acStatuses);
  const passedAcs = allAcs.filter((a) => a.status === "PASS").length;
  const failedAcs = allAcs.filter((a) => a.status === "FAIL");
  const blockedAcs = allAcs.filter((a) => a.status === "BLOCKED");
  const journeyVerdict =
    failedAcs.length > 0
      ? "FAIL"
      : blockedAcs.length > 0
        ? "BLOCKED"
        : passedAcs === allAcs.length
          ? "PASS"
          : "PARTIAL";

  lines.push(`## Journey verdict: ${journeyVerdict}`);
  lines.push("");
  lines.push(`- **Acceptance criteria passed:** ${passedAcs} / ${allAcs.length}`);
  lines.push(`- **Chapters run:** ${found.length} of ${orderedIds.length}`);
  if (failedAcs.length > 0) {
    lines.push(`- **Failed:** ${failedAcs.map((a) => `${a.code} (${a.outcome})`).join("; ")}`);
  }
  if (blockedAcs.length > 0) {
    lines.push(`- **Blocked:** ${blockedAcs.map((a) => `${a.code}`).join(", ")}`);
  }
  lines.push("");

  for (const { chapterId, report } of found) {
    lines.push(`## ${report.meta.title} — ${report.verdict}`);
    lines.push("");
    lines.push(
      `Persona: ${report.meta.persona}. Detail: [\`journey/${chapterId}/REPORT.md\`](journey/${chapterId}/REPORT.md).`,
    );
    lines.push("");
    lines.push("| AC | Outcome | Status |");
    lines.push("|---|---|---|");
    for (const a of report.acStatuses) {
      lines.push(`| ${a.code} | ${a.outcome} | ${a.status} |`);
    }
    lines.push("");
  }

  await fs.mkdir(path.dirname(aggregateDest), { recursive: true });
  await fs.writeFile(aggregateDest, `${lines.join("\n")}\n`, "utf8");
}

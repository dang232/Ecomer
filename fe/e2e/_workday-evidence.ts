import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

export { expectNoGlobalError } from "./_helpers";
import { credentialForPersona, type Persona } from "./modernization/_credentials";
export type { Persona } from "./modernization/_credentials";

interface StepRow {
  index: number;
  title: string;
  slug: string;
  status: "PASS" | "FAIL";
  errorMessage?: string;
}

export interface EvidencePathOptions {
  rootDir?: string;
  runId?: string;
}

export interface EvidencePaths {
  rootDir: string;
  runId?: string;
  runRootDir: string;
  personaDir: string;
  screenshotsDir: string;
  traceFile: string;
  reportFile: string;
  videoFile: string;
}

interface EvidenceState {
  counter: number;
  report: StepRow[];
  pendingOutputDirs: string[];
}

const evidenceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "evidence");
const runRootSegment = "runs";
const invalidRunIdCharacters = /[<>:"/\\|?*]/g;
const controlCharacters = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}]`, "g");
const evidenceStates = new Map<string, EvidenceState>();
const loginHeadingPattern = /Sign in to VNShop|\u0110\u0103ng nh\u1eadp VNShop/i;
const loginButtonPattern = /^(Sign in|\u0110\u0103ng nh\u1eadp)$/i;
const logoutPattern = /^(Log out|\u0110\u0103ng xu\u1ea5t)$/i;
const loggedOutLinkPattern = /^(Log in|\u0110\u0103ng nh\u1eadp)$/i;

function normalizeRunId(runId: string | undefined): string | undefined {
  if (!runId) {
    return undefined;
  }

  const normalized = runId
    .trim()
    .replace(invalidRunIdCharacters, "-")
    .replace(controlCharacters, "-")
    .replace(/\s+/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/[.\s-]+$/g, "");

  return normalized || undefined;
}

export function resolveEvidencePaths(
  persona: Persona,
  options: EvidencePathOptions = {},
): EvidencePaths {
  const rootDir = options.rootDir ?? evidenceRoot;
  const runId = normalizeRunId(options.runId ?? process.env.WORKDAY_EVIDENCE_RUN_ID);
  const runRootDir = runId ? path.join(rootDir, runRootSegment, runId) : rootDir;
  const personaDir = path.join(runRootDir, persona);

  return {
    rootDir,
    runId,
    runRootDir,
    personaDir,
    screenshotsDir: path.join(personaDir, "screenshots"),
    traceFile: path.join(personaDir, "trace.zip"),
    reportFile: path.join(personaDir, "REPORT.md"),
    videoFile: path.join(personaDir, "video.webm"),
  };
}

function evidenceStateFor(
  persona: Persona,
  options: EvidencePathOptions = {},
): { paths: EvidencePaths; state: EvidenceState } {
  const paths = resolveEvidencePaths(persona, options);
  const key = paths.personaDir;

  let state = evidenceStates.get(key);
  if (!state) {
    state = { counter: 0, report: [], pendingOutputDirs: [] };
    evidenceStates.set(key, state);
  }

  return { paths, state };
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "step"
  );
}

export async function resetPersona(
  persona: Persona,
  options: EvidencePathOptions = {},
): Promise<void> {
  const { paths, state } = evidenceStateFor(persona, options);
  state.counter = 0;
  state.report = [];
  state.pendingOutputDirs = [];

  await fs.rm(paths.screenshotsDir, { recursive: true, force: true });
  await fs.mkdir(paths.screenshotsDir, { recursive: true });
  await fs.mkdir(paths.personaDir, { recursive: true });
}

export async function step(
  page: Page,
  persona: Persona,
  title: string,
  fn: () => Promise<void>,
  options: EvidencePathOptions = {},
): Promise<void> {
  const { paths, state } = evidenceStateFor(persona, options);
  state.counter += 1;

  const index = state.counter;
  const indexStr = index.toString().padStart(2, "0");
  const filename = `${indexStr}-${slugify(title)}.png`;
  const screenshotPath = path.join(paths.screenshotsDir, filename);

  await test.step(`[${persona}/${indexStr}] ${title}`, async () => {
    let failure: Error | undefined;
    try {
      await fn();
    } catch (err) {
      failure = err instanceof Error ? err : new Error(String(err));
    }

    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch {
      // Preserve the original failure if the page is already gone.
    }

    state.report.push({
      index,
      title,
      slug: filename,
      status: failure ? "FAIL" : "PASS",
      errorMessage: failure?.message,
    });

    if (failure) {
      throw failure;
    }
  });
}

export async function startTrace(
  persona: Persona,
  page: Page,
  options: EvidencePathOptions = {},
): Promise<void> {
  const { paths } = evidenceStateFor(persona, options);
  await fs.mkdir(paths.personaDir, { recursive: true });

  try {
    await page.context().tracing.start({
      screenshots: false,
      snapshots: true,
      sources: true,
      title: `workday-${persona}`,
    });
  } catch {
    // Playwright may already be tracing for this context.
  }
}

export async function stopTrace(
  persona: Persona,
  page: Page,
  options: EvidencePathOptions = {},
): Promise<void> {
  const { paths } = evidenceStateFor(persona, options);

  try {
    await page.context().tracing.stop({ path: paths.traceFile });
  } catch {
    // No active trace to stop.
  }
}

export function rememberOutputDir(
  persona: Persona,
  testInfo: TestInfo,
  options: EvidencePathOptions = {},
): void {
  const { state } = evidenceStateFor(persona, options);
  state.pendingOutputDirs.push(testInfo.outputDir);
}

export async function copyArtifacts(
  persona: Persona,
  options: EvidencePathOptions = {},
): Promise<void> {
  const { paths, state } = evidenceStateFor(persona, options);
  await fs.mkdir(paths.personaDir, { recursive: true });

  for (const outputDir of state.pendingOutputDirs) {
    const src = path.join(outputDir, "video.webm");
    try {
      await fs.copyFile(src, paths.videoFile);
    } catch {
      // Video may be disabled or absent for this run.
    }
  }
}

export async function finalizeReport(
  persona: Persona,
  options: EvidencePathOptions = {},
): Promise<void> {
  const { paths, state } = evidenceStateFor(persona, options);
  await fs.mkdir(paths.personaDir, { recursive: true });

  const rows = state.report;
  const passed = rows.filter((row) => row.status === "PASS").length;
  const failed = rows.length - passed;
  const verdict = failed === 0 ? "PASS" : "FAIL";

  const lines: string[] = [];
  lines.push(`# Workday - ${persona[0].toUpperCase()}${persona.slice(1)}`);
  lines.push("");
  lines.push(`**Verdict:** ${verdict}`);
  lines.push(`**Steps:** ${passed} / ${rows.length} passed`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Steps");
  lines.push("");

  for (const row of rows) {
    const indexStr = row.index.toString().padStart(2, "0");
    lines.push(`### ${indexStr}. ${row.title} - ${row.status}`);
    lines.push("");
    lines.push(`![${row.title}](screenshots/${row.slug})`);
    lines.push("");
    if (row.errorMessage) {
      lines.push("```");
      lines.push(row.errorMessage);
      lines.push("```");
      lines.push("");
    }
  }

  lines.push("## Artifacts");
  lines.push("");
  lines.push("- `trace.zip` - open with `npx playwright show-trace trace.zip`");
  lines.push("- `video.webm` - full session recording (gitignored)");
  lines.push("- `screenshots/` - one `NN-slug.png` per step, regenerated each run");

  await fs.writeFile(paths.reportFile, `${lines.join("\n")}\n`, "utf8");
}

export async function loginAsSeededUser(page: Page, persona: Persona): Promise<void> {
  const { username, password } = credentialForPersona(persona);
  await page.goto("/login");
  await expect(page.getByText(loginHeadingPattern).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: loginButtonPattern }).click();
  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 30_000,
      message: `login as ${persona} did not navigate to the SPA`,
    })
    .toBe(persona === "admin" ? "/admin" : "/");
}

/**
 * Open the user menu and click logout. Prefer the storefront's accessible
 * account/user-menu trigger, then fall back to the console's generic
 * aria-haspopup trigger. After opening, support either a plain button or
 * a menuitem logout control.
 */
export async function logoutViaUserMenu(page: Page): Promise<void> {
  const stableTrigger = page.locator("[data-account-menu-trigger]").first();
  const namedTrigger = page.getByRole("button", { name: /account menu|user menu/i }).first();
  const fallbackTrigger = page
    .locator('button[aria-haspopup="true"], button[aria-haspopup="menu"]')
    .first();
  const menuTrigger = (await stableTrigger.isVisible().catch(() => false))
    ? stableTrigger
    : (await namedTrigger.isVisible().catch(() => false))
      ? namedTrigger
      : fallbackTrigger;

  await expect(menuTrigger).toBeVisible({ timeout: 10_000 });
  await menuTrigger.click();

  const openMenu = page.locator('[role="menu"]:visible').last();
  const menuLogout = openMenu.getByRole("menuitem", { name: logoutPattern }).first();
  if (await menuLogout.isVisible().catch(() => false)) {
    await menuLogout.click();
  } else {
    const pageLogout = page.getByRole("button", { name: logoutPattern }).first();
    await expect(pageLogout).toBeVisible({ timeout: 10_000 });
    await pageLogout.click();
  }

  await expect(page.getByRole("link", { name: loggedOutLinkPattern }).first()).toBeVisible({
    timeout: 15_000,
  });
}

import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export { expectNoGlobalError } from "./_helpers";

/**
 * Evidence helper for the persona-workday Playwright suite. Wraps
 * test.step() with a numbered screenshot + a markdown row, and writes
 * a self-contained REPORT.md per persona at the end of the run.
 *
 * Layout produced (matches docs/superpowers/specs/2026-05-23-persona-workday-playwright-design.md):
 *
 *   fe/e2e/evidence/<persona>/
 *   ├── screenshots/NN-slug.png   (committed)
 *   ├── trace.zip                 (committed)
 *   ├── video.webm                (gitignored)
 *   └── REPORT.md                 (committed, regenerated each run)
 */

export type Persona = "buyer" | "seller" | "admin";

interface StepRow {
  index: number;
  title: string;
  slug: string;
  status: "PASS" | "FAIL";
  errorMessage?: string;
}

const counters: Record<Persona, number> = { buyer: 0, seller: 0, admin: 0 };
const reports: Record<Persona, StepRow[]> = { buyer: [], seller: [], admin: [] };

const evidenceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "evidence");

function evidenceDir(persona: Persona): string {
  return path.join(evidenceRoot, persona);
}

function shotDir(persona: Persona): string {
  return path.join(evidenceDir(persona), "screenshots");
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

export async function resetPersona(persona: Persona): Promise<void> {
  counters[persona] = 0;
  reports[persona] = [];
  // Wipe and recreate the screenshots folder so stale shots from prior runs
  // don't pollute the report.
  await fs.rm(shotDir(persona), { recursive: true, force: true });
  await fs.mkdir(shotDir(persona), { recursive: true });
  await fs.mkdir(evidenceDir(persona), { recursive: true });
}

/**
 * Wraps Playwright's test.step():
 *   - Increments the persona's step counter
 *   - Runs the body
 *   - Takes a screenshot (numbered + slugged)
 *   - Pushes a row into the report (PASS or FAIL)
 *   - Rethrows on failure so the test fails normally
 */
export async function step(
  page: Page,
  persona: Persona,
  title: string,
  fn: () => Promise<void>,
): Promise<void> {
  counters[persona] += 1;
  const index = counters[persona];
  const slug = slugify(title);
  const indexStr = index.toString().padStart(2, "0");
  const filename = `${indexStr}-${slug}.png`;
  const screenshotPath = path.join(shotDir(persona), filename);

  await test.step(`[${persona}/${indexStr}] ${title}`, async () => {
    let failure: Error | undefined;
    try {
      await fn();
    } catch (err) {
      failure = err instanceof Error ? err : new Error(String(err));
    }
    // Always try to capture a shot — even on failure — so the evidence
    // reflects the moment things went wrong.
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch {
      // Page may already be closed if the failure was catastrophic; the
      // missing screenshot is logged in the row's status.
    }
    reports[persona].push({
      index,
      title,
      slug: filename,
      status: failure ? "FAIL" : "PASS",
      errorMessage: failure?.message,
    });
    if (failure) throw failure;
  });
}

/**
 * Manual tracing: start in beforeAll, stop+write in afterAll. This is
 * deliberately NOT delegated to `trace: "on"` in test.use — Playwright
 * finalizes that trace during BrowserContext close, which races with
 * afterAll's copyFile. Driving tracing ourselves lets us write directly
 * to fe/e2e/evidence/<persona>/trace.zip with no race.
 */
export async function startTrace(persona: Persona, page: Page): Promise<void> {
  await fs.mkdir(evidenceDir(persona), { recursive: true });
  try {
    await page.context().tracing.start({
      // Drop the per-action screenshot stream — we already produce one
      // numbered screenshot per step via step(), and the duplicated stream
      // pushes trace.zip into the 10MB+ range. snapshots + sources still
      // give the trace viewer a usable dom timeline.
      screenshots: false,
      snapshots: true,
      sources: true,
      title: `workday-${persona}`,
    });
  } catch {
    // start() throws if a trace is already running (e.g. trace: "on" in
    // test.use). The pre-existing trace will land via Playwright's
    // attachment mechanism — we just won't have a manual one here.
  }
}

export async function stopTrace(persona: Persona, page: Page): Promise<void> {
  const dest = path.join(evidenceDir(persona), "trace.zip");
  try {
    await page.context().tracing.stop({ path: dest });
  } catch {
    // No active trace — fall through to copyArtifacts which will sweep
    // the Playwright-managed trace from outputDir if one exists.
  }
}

/**
 * Copy the per-test video.webm out of Playwright's outputDir into
 * fe/e2e/evidence/<persona>/. video.webm is finalized before afterAll
 * resolves, so a plain copyFile here is sufficient.
 */
const pendingOutputDirs: Record<Persona, string[]> = {
  buyer: [],
  seller: [],
  admin: [],
};

export function rememberOutputDir(persona: Persona, testInfo: TestInfo): void {
  pendingOutputDirs[persona].push(testInfo.outputDir);
}

export async function copyArtifacts(persona: Persona): Promise<void> {
  const dest = evidenceDir(persona);
  await fs.mkdir(dest, { recursive: true });

  for (const outputDir of pendingOutputDirs[persona]) {
    const src = path.join(outputDir, "video.webm");
    try {
      await fs.copyFile(src, path.join(dest, "video.webm"));
    } catch {
      // No video — possibly disabled or never finalized; skip.
    }
  }
}

export async function finalizeReport(persona: Persona): Promise<void> {
  const dest = evidenceDir(persona);
  await fs.mkdir(dest, { recursive: true });

  const rows = reports[persona];
  const passed = rows.filter((r) => r.status === "PASS").length;
  const failed = rows.length - passed;
  const verdict = failed === 0 ? "PASS" : "FAIL";

  const lines: string[] = [];
  lines.push(`# Workday — ${persona[0].toUpperCase()}${persona.slice(1)}`);
  lines.push("");
  lines.push(`**Verdict:** ${verdict}`);
  lines.push(`**Steps:** ${passed} / ${rows.length} passed`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Steps");
  lines.push("");
  for (const r of rows) {
    const indexStr = r.index.toString().padStart(2, "0");
    lines.push(`### ${indexStr}. ${r.title} — ${r.status}`);
    lines.push("");
    lines.push(`![${r.title}](screenshots/${r.slug})`);
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

  await fs.writeFile(path.join(dest, "REPORT.md"), `${lines.join("\n")}\n`, "utf8");
}

/**
 * Cross-language matcher for the global error fallback. Use after every
 * navigation in a workday step.
 */

/**
 * Drive the /login form for one of the seeded realm users (`seller1`,
 * `admin1`, etc., all with password `test`). Polls until the SPA finishes
 * its redirect to /. Used by the seller and admin workday specs; the
 * buyer workday registers fresh and uses /register instead.
 */
export async function loginAsSeededUser(
  page: Page,
  username: string,
  password = "test",
): Promise<void> {
  await page.goto("/login");
  await expect(page.getByText(/Sign in to VNShop|Đăng nhập VNShop/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^(Sign in|Đăng nhập)$/i }).click();
  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 30_000,
      message: `login as ${username} did not navigate to the SPA`,
    })
    .toBe(username === "admin1" ? "/admin" : "/");
}

/**
 * Open the header user-menu and click logout. Anchors on accessible names
 * so we don't depend on icon implementation details.
 */
export async function logoutViaUserMenu(page: Page): Promise<void> {
  const menuTrigger = page.getByRole("button", { name: /account menu|user menu/i }).first();
  await expect(menuTrigger).toBeVisible({ timeout: 10_000 });
  await menuTrigger.click();
  const logoutButton = page.getByRole("button", { name: /^(Log out|Đăng xuất)$/i }).first();
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
  } else {
    await page.getByRole("menuitem", { name: /^(Log out|Đăng xuất)$/i }).first().click();
  }
  await expect(page.getByRole("link", { name: /^(Log in|Đăng nhập)$/i }).first()).toBeVisible({
    timeout: 15_000,
  });
}

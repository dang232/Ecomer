import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, test, type TestInfo } from "@playwright/test";

import {
  copyArtifacts,
  finalizeReport,
  logoutViaUserMenu,
  rememberOutputDir,
  resetPersona,
  resolveEvidencePaths,
  startTrace,
  step,
  stopTrace,
} from "./_workday-evidence";

function createFakePage(expectedTracePath: string) {
  return {
    context: () => ({
      tracing: {
        start: ({ title }: { title: string }) => {
          expect(title).toBe("workday-buyer");
        },
        stop: async ({ path: tracePath }: { path: string }) => {
          expect(tracePath).toBe(expectedTracePath);
          await fs.mkdir(path.dirname(tracePath), { recursive: true });
          await fs.writeFile(tracePath, "trace", "utf8");
        },
      },
    }),
    screenshot: async ({ path: screenshotPath }: { path?: string }) => {
      if (!screenshotPath) {
        throw new Error("expected screenshot path");
      }
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await fs.writeFile(screenshotPath, "shot", "utf8");
    },
  };
}

async function exerciseBuyerEvidence(
  page: Parameters<typeof logoutViaUserMenu>[0],
  rootDir: string,
  runId?: string,
): Promise<{
  paths: ReturnType<typeof resolveEvidencePaths>;
  screenshotFiles: string[];
}> {
  const options = runId ? { rootDir, runId } : { rootDir };
  const paths = resolveEvidencePaths("buyer", options);

  await page.setContent(`<main><h1>${runId ?? "legacy"}</h1></main>`);
  await resetPersona("buyer", options);
  await step(page, "buyer", `step for ${runId ?? "legacy"}`, () => Promise.resolve(), options);
  await step(page, "buyer", `follow up for ${runId ?? "legacy"}`, () => Promise.resolve(), options);
  await finalizeReport("buyer", options);

  return {
    paths,
    screenshotFiles: (await fs.readdir(paths.screenshotsDir)).sort(),
  };
}

test("WORKDAY_EVIDENCE_RUN_ID keeps legacy plus two run IDs isolated in one worker", async ({
  page,
}) => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "vnshop-workday-evidence-"));
  const previousRunId = process.env.WORKDAY_EVIDENCE_RUN_ID;

  try {
    delete process.env.WORKDAY_EVIDENCE_RUN_ID;
    const legacyResolved = resolveEvidencePaths("buyer", { rootDir });
    const legacyRun = await exerciseBuyerEvidence(page, rootDir, legacyResolved.runId);

    process.env.WORKDAY_EVIDENCE_RUN_ID = "run-a";
    const runAResolved = resolveEvidencePaths("buyer", { rootDir });
    const runARun = await exerciseBuyerEvidence(page, rootDir, runAResolved.runId);

    process.env.WORKDAY_EVIDENCE_RUN_ID = "run-b";
    const runBResolved = resolveEvidencePaths("buyer", { rootDir });
    const runBRun = await exerciseBuyerEvidence(page, rootDir, runBResolved.runId);

    const { paths: legacyPaths } = legacyRun;
    const { paths: runAPaths } = runARun;
    const { paths: runBPaths } = runBRun;

    expect(legacyResolved.runId).toBeUndefined();
    expect(runAResolved.runId).toBe("run-a");
    expect(runBResolved.runId).toBe("run-b");

    expect(legacyPaths.personaDir).toBe(path.join(rootDir, "buyer"));
    expect(runAPaths.personaDir).toBe(path.join(rootDir, "runs", "run-a", "buyer"));
    expect(runBPaths.personaDir).toBe(path.join(rootDir, "runs", "run-b", "buyer"));

    expect(legacyRun.screenshotFiles).toEqual([
      "01-step-for-legacy.png",
      "02-follow-up-for-legacy.png",
    ]);
    expect(runARun.screenshotFiles).toHaveLength(2);
    expect(runBRun.screenshotFiles).toHaveLength(2);

    expect(runARun.screenshotFiles[0]).toMatch(/^01-/);
    expect(runARun.screenshotFiles[1]).toMatch(/^02-/);
    expect(runBRun.screenshotFiles[0]).toMatch(/^01-/);
    expect(runBRun.screenshotFiles[1]).toMatch(/^02-/);

    const legacyReport = await fs.readFile(legacyPaths.reportFile, "utf8");
    const runAReport = await fs.readFile(runAPaths.reportFile, "utf8");
    const runBReport = await fs.readFile(runBPaths.reportFile, "utf8");

    expect(legacyReport).toContain("01. step for legacy");
    expect(legacyReport).toContain("02. follow up for legacy");
    expect(legacyReport).not.toContain("run-a");
    expect(legacyReport).not.toContain("run-b");

    expect(runAReport).toContain("01. step for run-a");
    expect(runAReport).toContain("02. follow up for run-a");
    expect(runAReport).not.toContain("legacy");
    expect(runAReport).not.toContain("run-b");

    expect(runBReport).toContain("01. step for run-b");
    expect(runBReport).toContain("02. follow up for run-b");
    expect(runBReport).not.toContain("legacy");
    expect(runBReport).not.toContain("run-a");
  } finally {
    if (previousRunId === undefined) {
      delete process.env.WORKDAY_EVIDENCE_RUN_ID;
    } else {
      process.env.WORKDAY_EVIDENCE_RUN_ID = previousRunId;
    }
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test("WORKDAY_EVIDENCE_RUN_ID routes trace and copied artifacts into the same run directory", async ({
  page: _page,
}, testInfo: TestInfo) => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "vnshop-workday-evidence-"));
  const previousRunId = process.env.WORKDAY_EVIDENCE_RUN_ID;

  try {
    process.env.WORKDAY_EVIDENCE_RUN_ID = "artifact-run";
    const paths = resolveEvidencePaths("buyer", { rootDir });
    const fakePage = createFakePage(paths.traceFile);
    const outputDir = path.join(testInfo.outputDir, "artifact-run");

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, "video.webm"), "video:artifact-run", "utf8");

    await resetPersona("buyer", { rootDir });
    rememberOutputDir("buyer", { ...testInfo, outputDir }, { rootDir });
    await startTrace("buyer", fakePage as never, { rootDir });
    await stopTrace("buyer", fakePage as never, { rootDir });
    await copyArtifacts("buyer", { rootDir });

    await expect(fs.readFile(paths.traceFile, "utf8")).resolves.toBe("trace");
    await expect(fs.readFile(paths.videoFile, "utf8")).resolves.toBe("video:artifact-run");
  } finally {
    if (previousRunId === undefined) {
      delete process.env.WORKDAY_EVIDENCE_RUN_ID;
    } else {
      process.env.WORKDAY_EVIDENCE_RUN_ID = previousRunId;
    }
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test("logoutViaUserMenu uses the accessible account menu trigger and plain logout button when present", async ({
  page,
}) => {
  await page.setContent(`
    <button aria-label="Account menu" id="store-trigger">Open account</button>
    <div id="panel" hidden>
      <button id="logout-button">Log out</button>
    </div>
    <a href="/login" hidden id="login-link">Log in</a>
    <script>
      document.getElementById('store-trigger').addEventListener('click', () => {
        document.getElementById('panel').hidden = false;
      });
      document.getElementById('logout-button').addEventListener('click', () => {
        document.getElementById('login-link').hidden = false;
      });
    </script>
  `);

  await logoutViaUserMenu(page);

  await expect(page.locator("#panel")).toBeVisible();
  await expect(page.locator("#login-link")).toBeVisible();
});

test("logoutViaUserMenu ignores an earlier notification menu trigger", async ({ page }) => {
  await page.setContent(`
    <button aria-label="Notifications" aria-haspopup="menu" id="notification-trigger">
      Notifications
    </button>
    <button aria-label="Menu tai khoan" aria-haspopup="menu" data-account-menu-trigger id="account-trigger">
      Account
    </button>
    <button id="profile-logout">Log out</button>
    <div role="menu" hidden id="account-menu">
      <button role="menuitem" id="logout-item">Log out</button>
    </div>
    <a href="/login" hidden id="login-link">Log in</a>
    <a href="/wrong-logout" hidden id="wrong-link">Wrong logout</a>
    <script>
      document.getElementById('account-trigger').addEventListener('click', () => {
        document.getElementById('account-menu').hidden = false;
      });
      document.getElementById('profile-logout').addEventListener('click', () => {
        document.getElementById('wrong-link').hidden = false;
      });
      document.getElementById('logout-item').addEventListener('click', () => {
        document.getElementById('login-link').hidden = false;
      });
    </script>
  `);

  await logoutViaUserMenu(page);

  await expect(page.locator("#account-menu")).toBeVisible();
  await expect(page.locator("#login-link")).toBeVisible();
  await expect(page.locator("#wrong-link")).toBeHidden();
});

test("logoutViaUserMenu falls back to the console trigger shape and menuitem logout", async ({
  page,
}) => {
  await page.setContent(`
    <button aria-haspopup="true" id="console-trigger">Console user</button>
    <div role="menu" hidden id="menu">
      <button role="menuitem" id="logout-item">Đăng xuất</button>
    </div>
    <a href="/login" hidden id="login-link">Đăng nhập</a>
    <script>
      document.getElementById('console-trigger').addEventListener('click', () => {
        document.getElementById('menu').hidden = false;
      });
      document.getElementById('logout-item').addEventListener('click', () => {
        document.getElementById('login-link').hidden = false;
      });
    </script>
  `);

  await logoutViaUserMenu(page);

  await expect(page.locator("#menu")).toBeVisible();
  await expect(page.locator("#login-link")).toBeVisible();
});

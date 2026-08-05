import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(feDir, "..");

test("frontend uses one pnpm lockfile and pnpm commands", async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(feDir, "package.json"), "utf8"),
  );
  const scripts = Object.values(packageJson.scripts).join("\n");
  const promote = await readFile(
    path.join(rootDir, ".github", "workflows", "promote.yml"),
    "utf8",
  );
  const dockerfile = await readFile(path.join(feDir, "Dockerfile"), "utf8");
  const docs = await Promise.all([
    readFile(path.join(feDir, "README.md"), "utf8"),
    readFile(path.join(rootDir, ".agents", "fe", "AGENTS.md"), "utf8"),
  ]);

  assert.equal(packageJson.packageManager, "pnpm@9.15.9");
  assert.equal(packageJson.devDependencies["@types/react-dom"], "19.2.3");
  assert.doesNotMatch(scripts, /\bnpm run\b/);
  assert.doesNotMatch(promote, /\bnpm ci\b|\bnpx playwright\b|fe\/package-lock\.json/);
  assert.match(dockerfile, /^FROM node:24-alpine@sha256:[0-9a-f]{64} AS build$/m);
  assert.match(
    dockerfile,
    /^FROM nginxinc\/nginx-unprivileged:[^\s@]+@sha256:[0-9a-f]{64} AS runtime$/m,
  );
  assert.match(dockerfile, /^RUN pnpm run build$/m);
  assert.doesNotMatch(dockerfile, /\bnpx vite build\b/);
  assert.doesNotMatch(dockerfile, /\bapk upgrade\b/);
  assert.doesNotMatch(docs.join("\n"), /\bnpm run\b/);
  await assert.rejects(readFile(path.join(feDir, "package-lock.json"), "utf8"));
});

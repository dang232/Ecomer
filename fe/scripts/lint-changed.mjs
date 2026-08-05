import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(feDir, "..");
const require = createRequire(import.meta.url);
const eslintPackage = require.resolve("eslint/package.json");
const eslintCli = path.join(path.dirname(eslintPackage), "bin", "eslint.js");

export function parseBase(args) {
  const index = args.indexOf("--base");
  if (index === -1) return "HEAD^";
  const value = args[index + 1];
  if (!value) throw new Error("--base requires a git ref");
  return value;
}

export function selectLintableFiles(files) {
  return files
    .filter((file) => /^fe\/.*\.(ts|tsx)$/.test(file))
    .map((file) => file.slice("fe/".length));
}

function main() {
  const base = parseBase(process.argv.slice(2));
  const changed = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", base, "--", "fe"],
    { cwd: rootDir, encoding: "utf8" },
  );
  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "--", "fe"],
    { cwd: rootDir, encoding: "utf8" },
  );
  const files = selectLintableFiles(
    `${changed}\n${untracked}`.split(/\r?\n/).filter(Boolean),
  );
  if (files.length === 0) return;
  const result = spawnSync(
    process.execPath,
    [eslintCli, "--max-warnings", "0", ...files],
    { cwd: feDir, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

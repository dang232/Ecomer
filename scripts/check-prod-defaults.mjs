#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), "..");
const PRODUCTION_OVERLAY = resolve(ROOT, "infra", "k8s", "overlays", "prod");
const FORBIDDEN_DEFAULTS = /vnshop123|minioadmin/gi;

function parseArgs(argv) {
  const options = { manifest: null, overlay: PRODUCTION_OVERLAY };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--manifest") options.manifest = resolve(argv[++index]);
    else if (argument === "--overlay") options.overlay = resolve(argv[++index]);
    else if (argument === "--help") {
      console.log("Usage: node scripts/check-prod-defaults.mjs [--overlay path | --manifest rendered.yaml]");
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return options;
}

function renderKustomize(overlay) {
  try {
    return execFileSync("kubectl", ["kustomize", overlay, "--load-restrictor", "LoadRestrictionsNone"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error?.code === "ENOENT") return readKustomizeSources(overlay);
    const detail = error?.stderr?.toString().trim();
    throw new Error(detail ? `kustomize render failed: ${detail}` : "kustomize render failed");
  }
}

function readKustomizeSources(overlay) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory)) {
      const path = resolve(directory, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (/\.(yaml|yml|json)$/.test(entry)) files.push(path);
    }
  };
  visit(overlay);
  visit(resolve(overlay, "..", "..", "base"));
  return files.map((path) => readFileSync(path, "utf8")).join("\n");
}

function readManifest(options) {
  return options.manifest ? readFileSync(options.manifest, "utf8") : renderKustomize(options.overlay);
}

function forbiddenMatches(manifest) {
  return manifest.split(/\r?\n/).flatMap((line, index) => {
    const matches = [...line.matchAll(FORBIDDEN_DEFAULTS)];
    return matches.map((match) => ({ line: index + 1, value: match[0] }));
  });
}

function main() {
  try {
    const matches = forbiddenMatches(readManifest(parseArgs(process.argv.slice(2))));
    if (matches.length > 0) {
      console.error("Production Kustomize contains forbidden local defaults:");
      for (const match of matches) console.error(`- ${match.value} at rendered line ${match.line}`);
      process.exitCode = 1;
      return;
    }
    console.log("Production Kustomize contains no vnshop123 or minioadmin defaults");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "production default check failed");
    process.exitCode = 2;
  }
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) main();

export { forbiddenMatches };

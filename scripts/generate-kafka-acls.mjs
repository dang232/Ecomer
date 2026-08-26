#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalScript = path.join(repo, "infra", "scripts", "generate-kafka-artifacts.mjs");
const result = spawnSync(process.execPath, [canonicalScript, ...process.argv.slice(2)], { cwd: repo, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

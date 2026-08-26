import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const args = process.argv.slice(2);

function parseRoots(argv) {
  const roots = [];
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag !== "--services" && flag !== "--frontend") {
      throw new Error(`unknown argument: ${flag}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a directory`);
    }
    roots.push(value);
    index += 1;
  }
  return roots;
}

let roots;
try {
  roots = parseRoots(args);
} catch (error) {
  console.error(error instanceof Error ? error.message : "invalid arguments");
  process.exitCode = 2;
  roots = [];
}
const focusedFiles = new Set([
  "ProductCatalogAdapter.java",
  "CartServiceAdapter.java",
  "ShippingServiceQuoteAdapter.java",
  "TranscodeFailureConsumer.java",
  "IdempotencyFilter.java",
]);
const violations = [];

function visit(root) {
  for (const entry of readdirSync(root)) {
    const file = join(root, entry);
    if (entry === "node_modules" || entry === "target" || entry === "dist") continue;
    if (statSync(file).isDirectory()) visit(file);
    else if (/\.(java|ts|tsx)$/.test(entry)) {
      const source = readFileSync(file, "utf8");
      if (file.endsWith(".java") && focusedFiles.has(entry)
        && /catch\s*\(\s*(Exception|RuntimeException)\s+/.test(source)
        && !/no-excuse-ok:\s*catch/.test(source)) violations.push(`${file}: generic Java catch`);
      if (file.includes(`${sep}fe${sep}src${sep}`)
        && /console\.(log|debug|info|warn|error)\s*\(/.test(source) && !file.endsWith("logger.ts")) violations.push(`${file}: direct console logging`);
    }
  }
}

for (const root of roots) if (root) visit(root);
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else console.log("error handling checks passed");

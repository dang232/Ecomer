import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_CURSOR_SECRETS, validateManifest } from "./validate-prod-secrets.mjs";

function parseArgs(argv) {
  const options = { before: null, after: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--before") options.before = argv[++index];
    else if (argument === "--after") options.after = argv[++index];
    else if (argument === "--help") {
      console.log("Usage: node scripts/rotate-credentials-check.mjs --before old.yaml --after new.yaml");
      process.exit(0);
    } else throw new Error(`unknown argument: ${argument}`);
  }
  if (!options.before || !options.after) throw new Error("--before and --after are required");
  return options;
}

function ciphertextMap(manifest) {
  const section = manifest.match(/kind:\s*SealedSecret[\s\S]*?\n\s*encryptedData:\s*\n([\s\S]*?)(?=\n\s*template:|\n---|$)/)?.[1] ?? "";
  const values = new Map();
  for (const match of section.matchAll(/^\s{2,}([A-Za-z0-9._-]+):\s*([^\s#]+)\s*$/gm)) values.set(match[1], match[2]);
  return values;
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const before = readFileSync(resolve(options.before), "utf8");
    const after = readFileSync(resolve(options.after), "utf8");
    const errors = [];
    const oldValues = ciphertextMap(before);
    const newValues = ciphertextMap(after);
    for (const [environmentKey, secretKey] of Object.entries(REQUIRED_CURSOR_SECRETS)) {
      const oldValue = oldValues.get(secretKey);
      const newValue = newValues.get(secretKey);
      if (!oldValue || !newValue) errors.push(`${environmentKey}: both rotation manifests must contain ciphertext`);
      else if (fingerprint(oldValue) === fingerprint(newValue)) errors.push(`${environmentKey}: ciphertext did not rotate`);
    }
    if (errors.length > 0) {
      console.error("Credential rotation check failed:");
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Credential rotation check passed (${Object.keys(REQUIRED_CURSOR_SECRETS).length} cursor keys rotated)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "credential rotation check failed");
    process.exitCode = 2;
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) main();

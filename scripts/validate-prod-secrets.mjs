import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");
const productionOverlay = resolve(repoRoot, "infra", "k8s", "overlays", "prod");

export const REQUIRED_CURSOR_SECRETS = Object.freeze({
  VNSHOP_PRODUCT_CURSOR_SECRET: "product-cursor-secret",
  VNSHOP_SEARCH_CURSOR_SECRET: "search-cursor-secret",
  ADMIN_CURSOR_SECRET: "admin-cursor-secret",
  VNSHOP_SELLER_FINANCE_ADMIN_CURSOR_SECRET: "seller-finance-admin-cursor-secret",
});

const PLACEHOLDER = /^(?:$|replace(?:[-_ ]with)?|change[-_ ]?me|changeme|example|placeholder|dummy|default|password|secret|test|todo|xxx|(?:0|a){8,})$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function parseArgs(argv) {
  const options = { manifest: null, overlay: productionOverlay };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--manifest") options.manifest = argv[++index];
    else if (argument === "--overlay") options.overlay = resolve(argv[++index]);
    else if (argument === "--help") {
      console.log("Usage: node scripts/validate-prod-secrets.mjs [--overlay path | --manifest rendered.yaml]");
      process.exit(0);
    } else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function renderKustomize(overlay) {
  try {
    return execFileSync("kubectl", ["kustomize", overlay, "--load-restrictor", "LoadRestrictionsNone"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = error?.stderr?.toString().trim();
    throw new Error(detail ? `kustomize render failed: ${detail}` : "kustomize render failed");
  }
}

function readManifest(options) {
  if (!options.manifest) return renderKustomize(options.overlay);
  const bytes = readFileSync(resolve(options.manifest));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.toString("utf16le");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.from(bytes.slice(2));
    for (let index = 0; index < swapped.length; index += 2) {
      const value = swapped[index];
      swapped[index] = swapped[index + 1];
      swapped[index + 1] = value;
    }
    return swapped.toString("utf16le");
  }
  return bytes.toString("utf8");
}

function collectSecretRefs(manifest) {
  const references = new Set();
  const inlinePattern = /secretKeyRef:\s*\{([^}\n]+)\}/g;
  for (const match of manifest.matchAll(inlinePattern)) {
    if (/\bname:\s*vnshop-runtime-secrets\b/.test(match[1])) {
      const key = match[1].match(/\bkey:\s*([A-Za-z0-9._-]+)/)?.[1];
      if (key) references.add(key);
    }
  }
  const multilinePattern = /secretKeyRef:\s*\n\s+(?:key:\s*([A-Za-z0-9._-]+)\s*\n\s+name:\s*vnshop-runtime-secrets|name:\s*vnshop-runtime-secrets\s*\n\s+key:\s*([A-Za-z0-9._-]+))/g;
  for (const match of manifest.matchAll(multilinePattern)) references.add(match[1] ?? match[2]);
  const renderedPattern = /secretKeyRef:[\s\S]{0,180}?\bkey:\s*([A-Za-z0-9._-]+)[\s\S]{0,100}?\bname:\s*vnshop-runtime-secrets|secretKeyRef:[\s\S]{0,100}?\bname:\s*vnshop-runtime-secrets[\s\S]{0,180}?\bkey:\s*([A-Za-z0-9._-]+)/g;
  for (const match of manifest.matchAll(renderedPattern)) references.add(match[1] ?? match[2]);
  const itemPattern = /secretName:\s*vnshop-runtime-secrets[\s\S]{0,500}?items:\s*([\s\S]{0,1000}?)(?=\n\S|\n---|$)/g;
  for (const match of manifest.matchAll(itemPattern)) {
    for (const item of match[1].matchAll(/\bkey:\s*([A-Za-z0-9._-]+)/g)) references.add(item[1]);
  }
  return references;
}

function collectEncryptedData(manifest) {
  const section = manifest.match(/kind:\s*SealedSecret[\s\S]*?\n\s*encryptedData:\s*\n([\s\S]*?)(?=\n\s*template:|\n---|$)/)?.[1] ?? "";
  const encryptedData = new Map();
  for (const match of section.matchAll(/^\s{2,}([A-Za-z0-9._-]+):\s*([^\s#]+)\s*$/gm)) encryptedData.set(match[1], match[2]);
  return encryptedData;
}

function validateCiphertext(key, value, errors) {
  if (!value || PLACEHOLDER.test(value)) {
    errors.push(`${key}: missing or placeholder ciphertext`);
    return;
  }
  if (!BASE64.test(value) || value.length < 32) errors.push(`${key}: ciphertext must be base64 with length >= 32`);
}

export function validateManifest(manifest) {
  const errors = [];
  const references = collectSecretRefs(manifest);
  const encryptedData = collectEncryptedData(manifest);
  if (!/kind:\s*SealedSecret\b/.test(manifest)) errors.push("vnshop-runtime-secrets: rendered SealedSecret is missing");
  for (const [environmentKey, secretKey] of Object.entries(REQUIRED_CURSOR_SECRETS)) {
    if (!references.has(secretKey)) errors.push(`${environmentKey}: rendered workload reference is missing`);
    validateCiphertext(secretKey, encryptedData.get(secretKey), errors);
  }
  return errors;
}

function main() {
  try {
    const errors = validateManifest(readManifest(parseArgs(process.argv.slice(2))));
    if (errors.length > 0) {
      console.error("Production secret validation failed:");
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Production secret validation passed (${Object.keys(REQUIRED_CURSOR_SECRETS).length} cursor keys checked)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "production secret validation failed");
    process.exitCode = 2;
  }
}

if (resolve(process.argv[1] ?? "") === scriptPath) main();

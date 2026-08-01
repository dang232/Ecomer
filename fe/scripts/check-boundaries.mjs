import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(feDir, "src");

export function inspectImport(file, specifier) {
  const candidate = specifier.startsWith("@/")
    ? `src/${specifier.slice(2)}`
    : specifier.startsWith(".")
      ? path.posix.join(path.posix.dirname(file), specifier)
      : specifier;
  const resolved = path.posix.normalize(candidate);

  if (file.startsWith("src/shared/") && /^src\/(app|features)(?:\/|$)/.test(resolved)) {
    return "shared must not import app or features";
  }
  if (file.startsWith("src/features/") && /^src\/app(?:\/|$)/.test(resolved)) {
    return "features must consume shared modules instead of app internals";
  }
  const owner = /^src\/features\/([^/]+)\//.exec(file)?.[1];
  const target = /^src\/features\/([^/]+)(\/.*)?$/.exec(resolved);
  if (file.startsWith("src/app/") && target?.[2]) {
    return "app must import features through their public index";
  }
  if (owner && target && target[1] !== owner && target[2]) {
    return "cross-feature imports must use the feature public index";
  }
  return null;
}

export function importSpecifiers(source) {
  const pattern = /(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g;
  return [...source.matchAll(pattern)].map((match) => match[1]).filter(Boolean);
}

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const target = path.join(directory, name);
    if (statSync(target).isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(name) ? [target] : [];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = [];
  for (const absoluteFile of sourceFiles(sourceDir)) {
    const file = path.relative(feDir, absoluteFile).replaceAll("\\", "/");
    const source = readFileSync(absoluteFile, "utf8");
    for (const specifier of importSpecifiers(source)) {
      const message = inspectImport(file, specifier);
      if (message) findings.push(`${file}: ${message}: ${specifier}`);
    }
  }
  if (findings.length > 0) {
    findings.forEach((finding) => console.error(finding));
    process.exitCode = 1;
  }
}

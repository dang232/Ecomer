import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_ENV_FILES = new Set([
  ".env.example",
  ".env.secrets.example",
  "secrets.env.local.example"
]);

const FORBIDDEN_PATHS = new Set([
  ".env.dokploy",
  "infra/kafka/certs/ssl_credentials",
  "ssh_private_key_for_dokploy.pem"
]);

const PRIVATE_KEY_MARKER = /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/;

export function validateTrackedFiles(paths, readText) {
  const errors = [];

  for (const originalPath of paths) {
    const path = originalPath.replaceAll("\\", "/");
    const name = basename(path);

    if (FORBIDDEN_PATHS.has(path)) {
      errors.push(`forbidden sensitive path is tracked: ${path}`);
    }
    if (name.startsWith(".env") && !ALLOWED_ENV_FILES.has(name) && !name.endsWith(".example")) {
      errors.push(`environment file is tracked: ${path}`);
    }
    if (
      /(?:^|[-_.])private[-_.]?key(?:[-_.]|$)/i.test(name) ||
      /^id_(?:rsa|dsa|ecdsa|ed25519)$/i.test(name) ||
      /\.(?:key|pem|p12|pfx|keystore)$/i.test(name)
    ) {
      errors.push(`private-key filename is tracked: ${path}`);
    }

    const content = readText(path);
    if (content && PRIVATE_KEY_MARKER.test(content)) {
      errors.push(`private-key material is tracked: ${path}`);
    }
  }

  return errors;
}

export function validateRepository(repoRoot) {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  const paths = output
    .split("\0")
    .filter(Boolean)
    .filter((path) => existsSync(resolve(repoRoot, path)));

  return validateTrackedFiles(paths, (path) => {
    const absolutePath = resolve(repoRoot, path);
    try {
      if (statSync(absolutePath).size > 1024 * 1024) {
        return "";
      }
      const content = readFileSync(absolutePath);
      return content.includes(0) ? "" : content.toString("utf8");
    } catch {
      return "";
    }
  });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const repoRoot = resolve(process.argv[2] ?? fileURLToPath(new URL("../..", import.meta.url)));
  const errors = validateRepository(repoRoot);

  if (errors.length > 0) {
    console.error("Sensitive-path validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Sensitive-path validation passed.");
  }
}

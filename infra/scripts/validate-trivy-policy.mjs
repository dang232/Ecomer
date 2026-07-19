import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function validateTrivyPolicy(text, now = new Date()) {
  const errors = [];
  const entries = text
    .split(/(?=^\s*- id:)/m)
    .map((body) => ({ body, id: /^\s*- id:\s*(\S+)\s*$/m.exec(body)?.[1] }))
    .filter((entry) => entry.id);

  for (const entry of entries) {
    const id = entry.id;
    const body = entry.body;
    const expiry = /^\s+expired_at:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(body)?.[1];
    const statement = /^\s+statement:\s*(.+)\s*$/m.exec(body)?.[1]?.trim();
    const scoped = /^\s+(?:paths|purls):\s*$/m.test(body);

    if (!expiry) {
      errors.push(`${id}: expired_at is required`);
    } else {
      const expiresAt = new Date(`${expiry}T23:59:59.999Z`);
      const maximum = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now || expiresAt > maximum) {
        errors.push(`${id}: expired_at must be in the next 30 days`);
      }
    }
    if (!statement || !/@[A-Za-z0-9_-]+/.test(statement) || !/[A-Z]+-\d+/.test(statement)) {
      errors.push(`${id}: statement must identify an owner and ticket`);
    }
    if (!scoped) {
      errors.push(`${id}: exception must be scoped with paths or purls`);
    }
  }

  return errors;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const policyPath = resolve(process.argv[2] ?? ".trivyignore.yaml");
  const errors = validateTrivyPolicy(readFileSync(policyPath, "utf8"));
  if (errors.length > 0) {
    console.error("Trivy exception policy validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Trivy exception policy is valid.");
  }
}

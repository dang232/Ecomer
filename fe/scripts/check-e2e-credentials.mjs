/**
 * TypeScript-aware credential audit for the E2E suite.
 *
 * Rejects seeded credential literals outside the centralized
 * `e2e/modernization/_credentials.ts` store when they appear in:
 *   - login helper defaults (`password = "test"`)
 *   - browser login helper calls (`loginViaOidc(...)`)
 *   - username/password field fills
 *   - direct `/auth/login` request payloads
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const e2eDir = path.resolve(scriptDir, "..", "e2e");
const allowedFiles = new Set(["modernization/_credentials.ts"]);
const seededUsernames = new Set(["buyer1", "seller1", "admin1"]);
const seededPassword = "test";
const seededAliasPattern = new RegExp(
  `^(?:${[...seededUsernames].join("|")})@[^@\\s]+$`,
  "i",
);

function sourceKind(filePath) {
  return filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function relativePath(filePath) {
  return filePath.replace(`${e2eDir}${path.sep}`, "").replace(/\\/g, "/");
}

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return sourceFiles(target);
        }
        return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
      }),
    )
  ).flat();
}

function positionLabel(sourceFile, node) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return line + 1;
}

function formatViolation(filePath, line, label, sample) {
  return `  ${filePath}:${line} - ${label}: ${sample}`;
}

function stringLiteralValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  return null;
}

function objectPropertyByName(node, targetName) {
  for (const property of node.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      propertyNameText(property.name) === targetName
    ) {
      return property.initializer;
    }
  }
  return null;
}

function loginUrlArg(call) {
  const firstArg = call.arguments[0];
  const urlText = firstArg ? firstArg.getText() : "";
  return urlText.includes("/auth/login");
}

function fillTargetText(call) {
  if (!ts.isPropertyAccessExpression(call.expression)) {
    return "";
  }
  return call.expression.expression.getText();
}

function isUsernameFieldFill(call, value) {
  return isSeededPrincipal(value) && /username|email/i.test(fillTargetText(call));
}

function isPasswordFieldFill(call, value) {
  return value === seededPassword && /password/i.test(fillTargetText(call));
}

function isSeededPrincipal(value) {
  return seededUsernames.has(value) || seededAliasPattern.test(value);
}

function inspectCallExpression(sourceFile, relPath, call, violations) {
  if (ts.isIdentifier(call.expression) && call.expression.text === "loginViaOidc") {
    const usernameValue = stringLiteralValue(call.arguments[1]);
    const passwordValue = stringLiteralValue(call.arguments[2]);
    if (usernameValue !== null && isSeededPrincipal(usernameValue)) {
      violations.push(
        formatViolation(
          relPath,
          positionLabel(sourceFile, call.arguments[1]),
          "hard-coded seeded username in loginViaOidc call",
          JSON.stringify(usernameValue),
        ),
      );
    }
    if (passwordValue === seededPassword) {
      violations.push(
        formatViolation(
          relPath,
          positionLabel(sourceFile, call.arguments[2]),
          'hard-coded password "test" in loginViaOidc call',
          JSON.stringify(passwordValue),
        ),
      );
    }
    return;
  }

  if (!ts.isPropertyAccessExpression(call.expression)) {
    return;
  }

  const method = call.expression.name.text;

  if (method === "fill" && call.arguments.length > 0) {
    const value = stringLiteralValue(call.arguments[0]);
    if (value === null) {
      return;
    }
    if (isUsernameFieldFill(call, value)) {
      violations.push(
        formatViolation(
          relPath,
          positionLabel(sourceFile, call.arguments[0]),
          "hard-coded seeded username fill outside credential store",
          JSON.stringify(value),
        ),
      );
    }
    if (isPasswordFieldFill(call, value)) {
      violations.push(
        formatViolation(
          relPath,
          positionLabel(sourceFile, call.arguments[0]),
          'hard-coded password "test" fill outside credential store',
          JSON.stringify(value),
        ),
      );
    }
    return;
  }

  if (method === "post" && loginUrlArg(call) && call.arguments.length > 1) {
    const options = call.arguments[1];
    if (!ts.isObjectLiteralExpression(options)) {
      return;
    }
    const data = objectPropertyByName(options, "data");
    if (!data || !ts.isObjectLiteralExpression(data)) {
      return;
    }
    const username = objectPropertyByName(data, "username") ?? objectPropertyByName(data, "email");
    const password = objectPropertyByName(data, "password");
    const usernameValue = username ? stringLiteralValue(username) : null;
    const passwordValue = password ? stringLiteralValue(password) : null;

    if (usernameValue !== null && isSeededPrincipal(usernameValue)) {
      violations.push(
        formatViolation(
          relPath,
          positionLabel(sourceFile, username),
          "inline seeded credential in /auth/login payload",
          JSON.stringify(usernameValue),
        ),
      );
    }
    if (passwordValue === seededPassword) {
      violations.push(
        formatViolation(
          relPath,
          positionLabel(sourceFile, password),
          'hard-coded password "test" in /auth/login payload',
          JSON.stringify(passwordValue),
        ),
      );
    }
    return;
  }

}

function inspectParameterDefaults(sourceFile, relPath, node, violations) {
  for (const parameter of node.parameters) {
    const name = ts.isIdentifier(parameter.name) ? parameter.name.text : "";
    const defaultValue = parameter.initializer
      ? stringLiteralValue(parameter.initializer)
      : null;
    if (name === "password" && defaultValue === seededPassword) {
      violations.push(
        formatViolation(
          relPath,
          positionLabel(sourceFile, parameter.initializer),
          'hard-coded password "test" default outside credential store',
          JSON.stringify(defaultValue),
        ),
      );
    }
  }
}

export function findViolations(filePath, content) {
  const relPath = filePath.includes(e2eDir) ? relativePath(filePath) : filePath.replace(/\\/g, "/");
  if (allowedFiles.has(relPath)) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    sourceKind(filePath),
  );
  const violations = [];

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      inspectParameterDefaults(sourceFile, relPath, node, violations);
    }

    if (ts.isCallExpression(node)) {
      inspectCallExpression(sourceFile, relPath, node, violations);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

export async function auditCredentials() {
  const files = await sourceFiles(e2eDir);
  const allViolations = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    allViolations.push(...findViolations(filePath, content));
  }

  return allViolations;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length > 0) {
    console.error("Usage: node scripts/check-e2e-credentials.mjs");
    process.exit(1);
  }

  const violations = await auditCredentials();
  if (violations.length > 0) {
    console.error("Credential audit FAILED. Violations found:");
    for (const violation of violations) {
      console.error(violation);
    }
    console.error("\nCredential literals must be defined in e2e/modernization/_credentials.ts");
    console.error("and resolved via loginAsPersona() or credentialForPersona().");
    process.exit(1);
  }

  console.log("Credential audit PASSED - no hard-coded seeded credentials found.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

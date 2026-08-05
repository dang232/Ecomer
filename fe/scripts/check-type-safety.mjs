import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseForESLint } from "@typescript-eslint/parser";
import ts from "typescript";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const commentPatterns = [
  ["@ts-ignore", /@ts-ignore/],
  ["@ts-expect-error", /@ts-expect-error/],
  ["@ts-nocheck", /@ts-nocheck/],
  [
    "lint suppression",
    /\beslint(?:-disable(?:-next-line|-line)?\b|[\s\S]*?:\s*(?:\[\s*)?(?:"off"|'off'|0)(?=\s|[,}\]]))/,
  ],
];

const unwrap = (node) => {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isAwaitExpression(current)) {
    current = current.expression;
  }
  return current;
};

const literalMemberName = (node) =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;

export function findUnsafeLines(source, fileName = "source.tsx") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const jsonParseAliases = new Set();
  const responseJsonAliases = new Set();
  const jsonValueAliases = new Set();
  const responseValueAliases = new Set();
  const findings = [];
  const parsed = parseForESLint(source, {
    comment: true,
    filePath: fileName,
    jsx: fileName.endsWith(".tsx"),
    loc: true,
    range: true,
  });

  for (const comment of parsed.ast.comments ?? []) {
    for (const [pattern, expression] of commentPatterns) {
      if (expression.test(comment.value)) findings.push({ line: comment.loc.start.line, pattern });
    }
  }

  const lineOf = (node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const add = (node, pattern) => findings.push({ line: lineOf(node), pattern });
  const isJsonParse = (expression) => {
    const target = unwrap(expression);
    return (
      (ts.isPropertyAccessExpression(target) &&
        ts.isIdentifier(target.expression) &&
        target.expression.text === "JSON" &&
        target.name.text === "parse") ||
      (ts.isElementAccessExpression(target) &&
        ts.isIdentifier(target.expression) &&
        target.expression.text === "JSON" &&
        literalMemberName(target.argumentExpression) === "parse") ||
      (ts.isIdentifier(target) && jsonParseAliases.has(target.text))
    );
  };
  const isResponseJson = (expression) => {
    const target = unwrap(expression);
    if (ts.isIdentifier(target)) return responseJsonAliases.has(target.text);
    if (ts.isPropertyAccessExpression(target)) {
      if (target.name.text === "bind" || target.name.text === "call")
        return isResponseJson(target.expression);
      return target.name.text === "json";
    }
    if (ts.isElementAccessExpression(target) && literalMemberName(target.argumentExpression)) {
      const member = literalMemberName(target.argumentExpression);
      if (member === "bind" || member === "call") return isResponseJson(target.expression);
      return member === "json";
    }
    return (
      ts.isCallExpression(target) &&
      (ts.isPropertyAccessExpression(target.expression) ||
        ts.isElementAccessExpression(target.expression)) &&
      ((ts.isPropertyAccessExpression(target.expression) &&
        target.expression.name.text === "bind") ||
        (ts.isElementAccessExpression(target.expression) &&
          literalMemberName(target.expression.argumentExpression) === "bind")) &&
      isResponseJson(target.expression.expression)
    );
  };
  const collectAliases = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer
    ) {
      const initializer = unwrap(node.initializer);
      for (const element of node.name.elements) {
        if (!ts.isIdentifier(element.name)) continue;
        const propertyName =
          element.propertyName && ts.isIdentifier(element.propertyName)
            ? element.propertyName.text
            : element.name.text;
        if (
          ts.isIdentifier(initializer) &&
          initializer.text === "JSON" &&
          propertyName === "parse"
        ) {
          jsonParseAliases.add(element.name.text);
        }
        if (propertyName === "json") responseJsonAliases.add(element.name.text);
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isJsonParse(node.initializer)
    ) {
      jsonParseAliases.add(node.name.text);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isResponseJson(node.initializer)
    ) {
      responseJsonAliases.add(node.name.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrap(node.initializer);
      if (ts.isCallExpression(initializer)) {
        if (isJsonParse(initializer.expression)) jsonValueAliases.add(node.name.text);
        if (isResponseJson(initializer.expression)) responseValueAliases.add(node.name.text);
      } else if (ts.isIdentifier(initializer)) {
        if (jsonValueAliases.has(initializer.text)) jsonValueAliases.add(node.name.text);
        if (responseValueAliases.has(initializer.text)) responseValueAliases.add(node.name.text);
      }
    }
    ts.forEachChild(node, collectAliases);
  };
  collectAliases(sourceFile);

  const visit = (node) => {
    if (ts.isNonNullExpression(node)) add(node, "non-null assertion");
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      if (node.type.kind === ts.SyntaxKind.AnyKeyword) add(node, "as any");
      const assertedExpression = unwrap(node.expression);
      if (
        (ts.isAsExpression(assertedExpression) ||
          ts.isTypeAssertionExpression(assertedExpression)) &&
        assertedExpression.type.kind === ts.SyntaxKind.UnknownKeyword
      ) {
        add(node, "double assertion");
      }
      if (ts.isIdentifier(assertedExpression) && jsonValueAliases.has(assertedExpression.text)) {
        add(node, "JSON.parse assertion");
      }
      if (
        ts.isIdentifier(assertedExpression) &&
        responseValueAliases.has(assertedExpression.text)
      ) {
        add(node, "response.json assertion");
      }
      if (ts.isCallExpression(assertedExpression)) {
        const callee = unwrap(assertedExpression.expression);
        if (isJsonParse(callee)) add(node, "JSON.parse assertion");
        if (isResponseJson(callee)) add(node, "response.json assertion");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return findings.sort((a, b) => a.line - b.line || a.pattern.localeCompare(b.pattern));
}

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const target = path.join(directory, name);
    if (statSync(target).isDirectory()) return filesUnder(target);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [target] : [];
  });
}

function run() {
  const findings = filesUnder(sourceRoot).flatMap((file) =>
    findUnsafeLines(readFileSync(file, "utf8"), file).map((finding) => ({
      file: path.relative(sourceRoot, file).replaceAll("\\", "/"),
      ...finding,
    })),
  );
  if (findings.length === 0) return;
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.pattern}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();

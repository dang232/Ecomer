#!/usr/bin/env node
/**
 * check-i18n-keys.mjs
 *
 * CI gate that scans every TypeScript / TSX file under fe/src/** for
 * `t("...")` (and `i18n.t("...")`) calls, then asserts that the first
 * string-literal argument resolves via dotted path in BOTH en.json AND
 * vi.json.
 *
 * Algorithm
 * ---------
 *  1. Load en.json + vi.json, build a flat dotted-key set per locale
 *     (e.g. "nav.home", "cart.errors.cantRemove"). Also keep the raw
 *     nested object for resolving branches.
 *  2. Recursively walk fe/src, collecting every *.ts / *.tsx file.
 *  3. For each file, run a regex that captures the first-argument
 *     string-literal of `t("...")` or `i18n.t("...")` calls. Template
 *     literals containing ${...} interpolation are reported as
 *     "dynamic" and are NOT failed (we cannot statically resolve
 *     variable suffixes), but they are listed at the end so a human
 *     can spot typos. Pure template literals with no interpolation
 *     (e.g. `t("foo.bar")`) ARE treated as static keys and checked.
 *  4. Skip lines that look like comments (// t("...") or /* t("...") *\/).
 *     Detected by stripping line comments and block comments before
 *     matching.
 *  5. For each static key, walk the dotted path in both locales; if
 *     either locale is missing it, emit a `file:line: missing key
 *     "x.y.z" (in <locale>)` line and increment the failure counter.
 *  6. Exit 0 if no static key is missing, exit 1 otherwise.
 *
 * Edge cases / allowlist (documented for reviewers)
 * -------------------------------------------------
 *  - `t(`foo.${bar}`)` -> dynamic; reported but does not fail.
 *  - `const KEY = "foo.bar"; t(KEY)` -> unresolved constant; we cannot
 *    statically follow identifiers, so we skip these. They will not
 *    produce false positives, but they are also not validated. Manual
 *    review recommended.
 *  - `t('foo.bar' as const)` -> the `as` clause is stripped before
 *    matching.
 *  - Comments containing t("...") -> stripped before matching.
 *  - Test files (*.test.ts, *.test.tsx) ARE included; missing keys in
 *    tests are still real bugs.
 *  - i18n.t(...) and t(...) are both treated as the translation function.
 *  - Whitespace and trailing punctuation in the first argument is
 *    ignored (e.g. `t(  "foo.bar"  )` matches).
 *
 * Usage
 * -----
 *   node scripts/check-i18n-keys.mjs                 # check both locales
 *   node scripts/check-i18n-keys.mjs --locale=en     # check a single locale
 *   node scripts/check-i18n-keys.mjs --src=src --locales=en,vi
 *
 * Exit codes
 * ----------
 *   0  all referenced keys resolve in every checked locale
 *   1  one or more keys are missing in at least one locale
 *   2  internal error (bad args, missing locale file, etc.)
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

// ---------- arg parsing ----------
function parseArgs(argv) {
  const opts = {
    src: "src",
    locales: ["en", "vi"],
    i18nDir: "src/app/lib/i18n",
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--src=")) opts.src = arg.slice("--src=".length);
    else if (arg.startsWith("--i18n-dir="))
      opts.i18nDir = arg.slice("--i18n-dir=".length);
    else if (arg.startsWith("--locales="))
      opts.locales = arg
        .slice("--locales=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (arg.startsWith("--locale="))
      opts.locales = [arg.slice("--locale=".length)];
  }
  return opts;
}

// ---------- dotted-key set builder ----------
function flatten(obj, prefix = "", out = new Set()) {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== "object" || Array.isArray(obj)) {
    if (prefix) out.add(prefix);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, next, out);
    } else {
      out.add(next);
    }
  }
  return out;
}

function resolveKey(key, localeObj) {
  // walk dotted path
  let cur = localeObj;
  for (const part of key.split(".")) {
    if (cur === null || typeof cur !== "object") return false;
    if (!(part in cur)) return false;
    cur = cur[part];
  }
  return true;
}

// ---------- file walker ----------
async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      // skip node_modules, dist, coverage, build artefacts
      if (["node_modules", "dist", "coverage", ".git", "build", ".next"].includes(e.name))
        continue;
      out.push(...(await walk(full)));
    } else if (e.isFile()) {
      if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
    }
  }
  return out;
}

// ---------- comment stripper ----------
function stripComments(src) {
  // Remove /* ... */ block comments (non-greedy, multi-line).
  // We deliberately do NOT touch // line comments because the regex
  // below is anchored to `t("...")` calls which we will match per-line.
  // Instead we filter matches whose strippedLine starts with //.
  return src.replace(/\/\*[\s\S]*?\*\//g, "");
}

// ---------- t-call extractor ----------
// Captures both `t("key")` and `i18n.t("key")`. The first capture group
// is the string literal content. We also capture the 1-based line
// number by walking the source line-by-line.
// Regex matches a `t(...)` call whose first arg is either a string
// literal (group 1 = quote, group 2 = body) OR a template literal
// (group 3 = whole `..` body). Dynamic template literals containing
// `${...}` are flagged but do not fail the build.
const T_CALL_RE =
  /(?:^|[^.\w$])(?:i18n\.)?t\(\s*(?:(['"])((?:\\.|(?!\1).)*)\1|(`)((?:\\.|(?!\3).)*)\3)/g;

function extractCalls(src) {
  const stripped = stripComments(src);
  const calls = [];
  // Walk line-by-line so we can skip comment lines cheaply.
  const lines = stripped.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip pure line comments and JSDoc-ish lines.
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) continue;
    T_CALL_RE.lastIndex = 0;
    let m;
    while ((m = T_CALL_RE.exec(line)) !== null) {
      // Either (m[1], m[2]) for a string literal, or (m[3], m[4])
      // for a template literal. Only one pair will be truthy per match.
      const quote = m[1] || m[3];
      const body = m[2] !== undefined ? m[2] : m[4];
      calls.push({ line: i + 1, quote, body });
    }
  }
  return calls;
}

// ---------- main ----------
async function main() {
  const opts = parseArgs(process.argv);
  const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..");
  const srcDir = resolve(repoRoot, opts.src);
  const i18nDir = resolve(repoRoot, opts.i18nDir);

  // Sanity: src must exist
  try {
    const s = await stat(srcDir);
    if (!s.isDirectory()) throw new Error("not a directory");
  } catch (e) {
    console.error(`[i18n-lint] ERROR: --src=${opts.src} does not exist or is not a directory (${srcDir})`);
    process.exit(2);
  }

  // Load locale files
  const localeData = new Map();
  for (const loc of opts.locales) {
    const p = join(i18nDir, `${loc}.json`);
    let raw;
    try {
      raw = await readFile(p, "utf8");
    } catch (e) {
      console.error(`[i18n-lint] ERROR: cannot read locale file ${p}`);
      process.exit(2);
    }
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      console.error(`[i18n-lint] ERROR: ${p} is not valid JSON: ${e.message}`);
      process.exit(2);
    }
    localeData.set(loc, { obj, flat: flatten(obj) });
  }

  const files = await walk(srcDir);
  files.sort();

  let missing = 0;
  const dynamicKeys = [];
  const seen = new Map(); // key -> Set<file:line> (for de-dup on report)

  for (const file of files) {
    let src;
    try {
      src = await readFile(file, "utf8");
    } catch (e) {
      continue;
    }
    const calls = extractCalls(src);
    if (calls.length === 0) continue;
    const rel = relative(repoRoot, file).split(sep).join("/");
    for (const c of calls) {
      const key = c.body;
      if (key.includes("${")) {
        // dynamic template literal; flag but do not fail
        dynamicKeys.push({ file: rel, line: c.line, key });
        continue;
      }
      // static key
      const bucket = seen.get(key) ?? new Set();
      for (const [loc, data] of localeData) {
        if (!resolveKey(key, data.obj)) {
          const tag = `${rel}:${c.line}:${loc}:${key}`;
          if (!bucket.has(tag)) {
            bucket.add(tag);
            missing++;
            console.error(
              `${rel}:${c.line}: missing key "${key}" (locale=${loc})`,
            );
          }
        }
      }
      seen.set(key, bucket);
    }
  }

  if (dynamicKeys.length > 0) {
    console.error("");
    console.error(
      `[i18n-lint] ${dynamicKeys.length} dynamic t(\`...${"${...}"}...\` ) call(s) were skipped (cannot statically resolve). Review manually:`,
    );
    for (const d of dynamicKeys) {
      console.error(`  ${d.file}:${d.line}: t(${dynamicRender(d.key)})`);
    }
  }

  if (missing > 0) {
    console.error("");
    console.error(
      `[i18n-lint] FAIL: ${missing} missing key reference(s) across ${seen.size} unique key(s).`,
    );
    process.exit(1);
  }
  console.log(
    `[i18n-lint] OK: checked ${files.length} file(s) against locales [${opts.locales.join(", ")}]. ${seen.size} unique static key(s) verified.`,
  );
  process.exit(0);
}

// Render a dynamic template fragment for human reading: keep backticks.
function dynamicRender(key) {
  return "`" + key + "`";
}

main().catch((e) => {
  console.error(`[i18n-lint] INTERNAL ERROR: ${e?.stack ?? e}`);
  process.exit(2);
});

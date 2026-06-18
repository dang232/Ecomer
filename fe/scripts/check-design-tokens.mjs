#!/usr/bin/env node
/**
 * check-design-tokens.mjs — CI gate against hardcoded hex color drift.
 *
 * Phase 7 of the v2 audit replaced 24 files of #00BFB3 (teal) with
 * `var(--primary)` / `bg-primary` design tokens. Without a guard, the next
 * contributor will reintroduce the same drift. This script:
 *
 *   1. Walks fe/src/**\/*.{ts,tsx,css,scss}
 *   2. Greps every line for hex color literals matching /#[0-9A-Fa-f]{3,8}/
 *   3. Allows files under fe/src/styles/  (the token-definition source of truth)
 *   4. Allows files that are explicit, documented exceptions
 *   5. Exits 0 if clean, 1 if any violation — output is `file:line  #VALUE`
 *
 * The regex is intentionally simple. It DOES catch:
 *   - #RGB               (e.g.  #0BF)
 *   - #RRGGBB            (e.g.  #00BFB3)
 *   - #RRGGBBAA          (e.g.  #00BFB3CC)
 *   - Tailwind arbitrary values  bg-[#FF00FF], text-[#abc]
 *
 * It does NOT match:
 *   - URL fragments / anchors  href="#section"  (not a hex)
 *   - CSS id selectors  #root { ... }  (only because we allowlist fe/src/styles/)
 *   - The `ufeff` BOM / line-noise — those won't match [0-9A-Fa-f]{3,8}
 *
 * Allowlist rationale:
 *   - fe/src/styles/  — the CSS files that DEFINE the token system. They must
 *     contain hex literals (e.g. in @theme, in fallback colors, in dark-mode
 *     overrides). Grepping them would be self-defeating.
 *   - Add additional files below with a one-line `WHY` comment.
 */

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SRC_ROOT = join(REPO_ROOT, 'src');
const STYLES_DIR = join(SRC_ROOT, 'styles'); // allowlisted

// Files that legitimately contain hex literals outside fe/src/styles/.
// Each entry MUST have a one-line `WHY` comment so future contributors
// understand the exception and can challenge it.
const EXTRA_ALLOWLIST = new Map([
  // WHY: TS equivalent of the CSS token definitions — single source of truth
  // for color constants re-used by inline styles. Mirrors fe/src/styles/.
  ['src/app/lib/ui/theme.ts', 'TS brand-token constants (analogous to fe/src/styles/)'],
  // WHY: programmatic avatar palette generator — produces deterministic
  // background colors for initial-letter avatars; tokens alone can't drive
  // a hashed selection from a finite palette.
  ['src/app/lib/initial-avatar.ts', 'deterministic avatar palette (hashed from seed)'],
  // WHY: the design-system showcase page literally renders the color swatch
  // catalog (Teal 50, Orange 400, etc.) as documentation.
  ['src/app/pages/DesignSystemPage.tsx', 'design-system showcase (color swatch catalog)'],
  // WHY: Sonner toaster className overrides use a navy+Meituan-red palette for
  // the dark-mode action-button and cancel-button — not brand tokens.
  ['src/app/App.tsx', 'Sonner toaster dark-mode className overrides (navy + Meituan red)'],
  // WHY: Auth pages (Login, Register, PasswordReset) use an indigo/violet gradient
  // scheme (#4f46e5 / #7c3aed) distinct from the teal/orange brand palette.
  ['src/app/pages/LoginPage.tsx', 'auth gradient indigo/violet (non-brand)'],
  ['src/app/pages/RegisterPage.tsx', 'auth gradient indigo/violet (non-brand)'],
  ['src/app/pages/PasswordResetPage.tsx', 'auth gradient indigo/violet (non-brand)'],
  // WHY: SystemHealth uses health-status colors (green/amber/red) that are not
  // brand palette tokens — they represent uptime status indicators.
  ['src/app/pages/admin/SystemHealth.tsx', 'system health status indicator colors (green/amber/red)'],
  // WHY: tests may exercise hex parsing or contain fixture data; not shipped
  // to production. Covers both .test.ts and .test.tsx under src/.
  // (Matched by suffix glob — see isAllowlisted below.)
]);

// Extensions we scan.
const EXTS = new Set(['.ts', '.tsx', '.css', '.scss']);

// Hex literal regex — matches #RGB, #RRGGBB, and #RRGGBBAA.
//
// False-positive guards (CRITICAL):
//   - Lookbehind for non-word boundary: avoids matching inside JSDoc identifiers
//     like `UserController#addAddress` (where `#add` would otherwise be a 3-char
//     hex hit; `#addAdd` would be a 6-char hit).
//   - Lookahead for non-word boundary: same reason on the trailing side.
//   - Together this restricts hits to "#XYZ" as its own token: after space,
//     punctuation, quotes, brackets, start-of-line, etc.
//
// This means we deliberately do NOT match:
//   - `UserController#addAddress`        (identifier preceded/followed by word char)
//   - `href="#section"`                  ('#section' contains 's','c','t','i','o','n' — non-hex)
//
// It DOES match:
//   - `bg-[#FF00FF]`                     (Tailwind arbitrary value)
//   - `color: "#00BFB3";`                (CSS-in-JS / string literal)
//   - `border: 1px solid #f0f;`          (CSS)
const HEX_RE = /(?<![\w])#[0-9A-Fa-f]{3,8}(?![\w])/g;

// -----------------------------------------------------------------------------
// Walker
// -----------------------------------------------------------------------------
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      // Skip node_modules / coverage / dist regardless of where they appear
      if (name === 'node_modules' || name === 'coverage' || name === 'dist') continue;
      yield* walk(full);
    } else {
      const dot = name.lastIndexOf('.');
      const ext = dot >= 0 ? name.slice(dot) : '';
      if (EXTS.has(ext)) yield full;
    }
  }
}

function isAllowlisted(absPath) {
  // Normalize to forward slashes for cross-platform string checks.
  const relFromSrc = relative(SRC_ROOT, absPath).split(sep).join(posix.sep);
  const relFromRoot = relative(REPO_ROOT, absPath).split(sep).join(posix.sep);
  if (relFromSrc.startsWith('styles/') || relFromSrc.startsWith('styles' + posix.sep)) return true;
  if (relFromRoot.startsWith('src/styles/')) return true;
  if (EXTRA_ALLOWLIST.has(relFromSrc)) return true;
  if (EXTRA_ALLOWLIST.has(relFromRoot)) return true;
  // Test files under src/ may contain fixture hex values; not shipped.
  if (relFromSrc.endsWith('.test.ts') || relFromSrc.endsWith('.test.tsx')) return true;
  return false;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
let violations = 0;
const report = [];

for (const file of walk(SRC_ROOT)) {
  if (isAllowlisted(file)) continue;
  const rel = relative(REPO_ROOT, file).split(sep).join(posix.sep);

  let content;
  try { content = readFileSync(file, 'utf8'); } catch { continue; }

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip lines that are clearly comments referencing the hex pattern
    // (e.g. "use var(--primary), not #00BFB3"). We do a minimal heuristic:
    // if the line is mostly a comment AND contains a hex mention, allow it.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      // Still flag if the hex is in a string literal inside the comment that
      // looks like a usage, e.g. `// bg-[#00BFB3]`. The risk of false positives
      // here is low and the cost of drift is high — keep it strict.
    }
    let m;
    HEX_RE.lastIndex = 0;
    while ((m = HEX_RE.exec(line)) !== null) {
      violations++;
      report.push(`${rel}:${i + 1}  ${m[0]}`);
    }
  }
}

if (violations === 0) {
  console.log('OK — no hardcoded hex colors found in fe/src/ (allowlist: fe/src/styles/).');
  process.exit(0);
}

console.error(`FAIL — ${violations} hardcoded hex color violation(s) in fe/src/:`);
for (const r of report) console.error('  ' + r);
console.error('\nUse design tokens (e.g. `var(--primary)`, `bg-primary`) instead.');
console.error('If a hex is genuinely required outside fe/src/styles/, add it to');
console.error('EXTRA_ALLOWLIST in fe/scripts/check-design-tokens.mjs with a WHY comment.');
process.exit(1);

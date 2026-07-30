import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertAccessiblePairs,
  contrastRatio,
  loadTokens,
  renderCss,
  renderDart,
} from "./generate-design-tokens.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");
const tokenPath = path.join(rootDir, "design-system", "tokens.json");

test("design tokens generate deterministic web and Flutter outputs", async () => {
  const tokens = await loadTokens(tokenPath);

  assert.equal(tokens.meta.version, 1);
  assert.equal(tokens.size.target.web, 44);
  assert.equal(tokens.size.target.mobile, 48);

  const css = renderCss(tokens);
  const dart = renderDart(tokens);

  assert.match(css, /--color-action-primary: #3347c7;/);
  assert.match(css, /--color-action-primary-rgb: 51, 71, 199;/);
  assert.match(css, /--radius-card: 8px;/);
  assert.match(dart, /static const actionPrimary = Color\(0xFF3347C7\);/);
  assert.match(dart, /static const double targetMobile = 48;/);
  assert.equal(renderCss(tokens), css);
  assert.equal(renderDart(tokens), dart);
});

test("declared foreground and background pairs meet WCAG AA", async () => {
  const tokens = await loadTokens(tokenPath);

  assert.doesNotThrow(() => assertAccessiblePairs(tokens));
});

test("web brand tokens emit CSS without changing Dart", async () => {
  const tokens = await loadTokens(tokenPath);
  const sharedOnly = structuredClone(tokens);
  delete sharedOnly.web;

  assert.match(renderCss(tokens), /--web-brand: #d63c2f;/);
  assert.match(renderCss(tokens), /--web-graphite: #24262b;/);
  assert.match(renderCss(tokens), /--web-cobalt: #2457c5;/);
  assert.equal(renderDart(tokens), renderDart(sharedOnly));
  assert.ok(
    contrastRatio(tokens.web.light.onBrand, tokens.web.light.brand) >= 4.5,
  );
  assert.ok(
    contrastRatio(tokens.web.dark.onBrand, tokens.web.dark.brand) >= 4.5,
  );
});

test("committed generated outputs are current", async () => {
  const tokens = await loadTokens(tokenPath);
  const [css, dart] = await Promise.all([
    readFile(
      path.join(rootDir, "fe", "src", "styles", "generated-tokens.css"),
      "utf8",
    ),
    readFile(
      path.join(
        rootDir,
        "vnshop_mobile",
        "lib",
        "core",
        "design_system",
        "generated",
        "design_tokens.dart",
      ),
      "utf8",
    ),
  ]);

  assert.equal(css, renderCss(tokens));
  assert.equal(dart, renderDart(tokens));
});

test("web and Flutter themes consume the generated semantic tokens", async () => {
  const [indexCss, themeCss, flutterTheme] = await Promise.all([
    readFile(path.join(rootDir, "fe", "src", "styles", "index.css"), "utf8"),
    readFile(path.join(rootDir, "fe", "src", "styles", "theme.css"), "utf8"),
    readFile(
      path.join(
        rootDir,
        "vnshop_mobile",
        "lib",
        "core",
        "theme",
        "app_theme.dart",
      ),
      "utf8",
    ),
  ]);

  assert.match(indexCss, /@import "\.\/generated-tokens\.css";/);
  assert.match(themeCss, /--primary: var\(--web-brand\);/);
  assert.match(themeCss, /--primary-hover: var\(--web-brand-hover\);/);
  assert.match(themeCss, /--primary-foreground: var\(--web-on-brand\);/);
  assert.match(themeCss, /--accent: var\(--web-campaign-accent\);/);
  assert.match(
    themeCss,
    /--accent-foreground: var\(--web-on-campaign-accent\);/,
  );
  assert.match(themeCss, /--commerce-info: var\(--web-cobalt\);/);
  assert.match(themeCss, /--utility-strong: var\(--web-graphite\);/);
  assert.match(flutterTheme, /generated\/design_tokens\.dart/);
  assert.match(flutterTheme, /primary: DesignColorsLight\.actionPrimary/);
  assert.match(flutterTheme, /primary: DesignColorsDark\.actionPrimary/);
});

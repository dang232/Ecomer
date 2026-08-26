#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), '..');
const topLevelTask = /^- \[[ xX]\] (\d+)\. /;

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function gitDiff() {
  try {
    return execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', '--', '.'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`git diff failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readIfPresent(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

async function walk(directory, result = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'target' || entry.name === 'dist') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, result);
    else result.push(path);
  }
  return result;
}

function report(label, value) {
  console.log(`${label}: ${value}`);
}

function isConfigurationPath(path) {
  return /(?:\.ya?ml|\.properties|\.conf|\.env|\.json)$/i.test(path);
}

function changedConfigurationText(diff) {
  const lines = [];
  let path = '';
  for (const line of diff.split(/\r?\n/)) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) path = fileMatch[1];
    if (line.startsWith('+') && !line.startsWith('+++') && isConfigurationPath(path)) lines.push(line.slice(1));
  }
  return lines.join('\n');
}

function normalizeProviderText(text, provider) {
  const normalizedProvider = provider.toLowerCase();
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
    .toLowerCase()
    .split(normalizedProvider)
    .join('provider_marker');
}

function providerIsEnabled(text, provider) {
  const uncommentedText = normalizeProviderText(text, provider);
  return [
    /\bprovider_marker_enabled\s*[:=]\s*["']?(?:true|1|yes)\b/,
    /\$\{\s*provider_marker_enabled\s*[:-]\s*(?:true|1|yes)\s*\}/,
    /\bprovider_marker\s*[-.]?enabled\s*[:=]\s*(?:true|1|yes)\b/,
    /(?:^|[\r\n])\s*provider_marker\s*:\s*(?:true|1|yes)\b/m,
    /(?:^|[\r\n])\s*provider_marker\s*:\s*[\r\n ]{1,80}enabled\s*:\s*(?:true|1|yes)\b/m,
  ].some((pattern) => pattern.test(uncommentedText));
}

function providerIsListed(text, provider) {
  const uncommentedText = normalizeProviderText(text, provider);
  return [
    /(?:payment_providers|paymentproviders)\s*[:=]\s*[^\r\n]*\bprovider_marker\b/,
    /(?:providers|payment-methods|paymentmethods)[\s\S]{0,160}\bprovider_marker\s*:\s*(?:true|1|yes)\b/,
    /(?:providers|payment-methods|paymentmethods)[\s\S]{0,160}[-[]\s*["']?provider_marker["']?(?:\s*[,\]]|\s*$)/m,
  ].some((pattern) => pattern.test(uncommentedText));
}

function providerIsDefault(text, provider) {
  const uncommentedText = normalizeProviderText(text, provider);
  return /(?:payment_default|payment_method_default|default-provider|default-method|payment-default)\s*[:=]\s*["']?provider_marker\b/.test(uncommentedText)
    || /(?:^|[\r\n])\s*default\s*:\s*["']?provider_marker\b/m.test(uncommentedText);
}

function hasNonProductionGate(text) {
  return /\bPAYMENT_NON_PRODUCTION_GATE\s*[:=]\s*["']?(?:true|1|yes)\b/i.test(text)
    || /\$\{\s*PAYMENT_NON_PRODUCTION_GATE\s*[:-]\s*(?:true|1|yes)\s*\}/i.test(text)
    || /non-production-gate\\s*:\s*(?:true|1|yes)\\b/i.test(text);
}

export function analyzeForbiddenProviders({ productionText, changedConfigText, providers = ['momo', 'vnpay'] }) {
  const violations = [];
  const changedGate = hasNonProductionGate(changedConfigText);
  for (const provider of providers) {
    const productionViolation = providerIsEnabled(productionText, provider)
      || providerIsListed(productionText, provider)
      || providerIsDefault(productionText, provider);
    const changedViolation = providerIsEnabled(changedConfigText, provider)
      || providerIsListed(changedConfigText, provider)
      || providerIsDefault(changedConfigText, provider);
    if (productionViolation || (changedViolation && !changedGate)) violations.push(provider);
  }
  return violations;
}

async function main() {
  const planPath = option('--plan') ?? process.argv.find((arg, index) => index > 1 && !arg.startsWith('--'));
  if (!planPath) throw new Error('usage: node scripts/verify-scope.mjs <plan-path> [--todos N] [--forbid-providers csv] [--require-external-secrets] [--forbid-retroactive-backfill]');
  const plan = await readFile(resolve(planPath), 'utf8');
  const requestedTodos = Number(option('--todos', '32'));
  const forbiddenProviders = (option('--forbid-providers', '') ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  const errors = [];
  const rows = plan.split(/\r?\n/).flatMap((line) => {
    const match = line.match(topLevelTask);
    return match ? [Number(match[1])] : [];
  });
  report('PLAN_TOP_LEVEL_TODOS', `${rows.length}/${requestedTodos}`);
  if (rows.length > requestedTodos || rows.some((id) => id > requestedTodos)) errors.push(`plan contains more than ${requestedTodos} top-level implementation todos`);

  const files = await walk(repoRoot);
  const prodFiles = files.filter((path) => /infra[\\/]k8s[\\/]overlays[\\/]prod/i.test(path) && isConfigurationPath(path));
  const prodText = (await Promise.all(prodFiles.map((path) => readIfPresent(path)))).join('\n');
  const diff = gitDiff();
  const changed = diff.split(/\r?\n/).filter((line) => line.startsWith('+') && !line.startsWith('+++')).join('\n');
  const changedConfig = changedConfigurationText(diff);

  const providerErrors = analyzeForbiddenProviders({ productionText: prodText, changedConfigText: changedConfig, providers: forbiddenProviders });
  for (const provider of providerErrors) errors.push(`forbidden provider ${provider} appears enabled/live/default-selected/listed in production or ungated changed configuration`);
  report('FORBIDDEN_PROVIDERS', errors.some((error) => error.includes('forbidden provider')) ? 'FAIL' : 'PASS');

  if (hasFlag('--require-external-secrets')) {
    const sealed = await readIfPresent(resolve(repoRoot, 'infra/k8s/base/sealedsecret.yaml'));
    const plaintextSecret = prodText
      .replace(/encryptedData:[\s\S]*?(?=\n\s*template:)/gi, '')
      .split(/\r?\n/)
      .some((line) => /(?:password|secret|token|api[_-]?key)\s*:/i.test(line) && !/(?:\$\{|valueFrom|secretKeyRef|secretName|encryptedData|\{\s*secretName|null|^\s*#)/i.test(line));
    if (!/vnshop\.io\/sealing-status:\s*required-before-promotion/i.test(sealed)) errors.push('production SealedSecret is not marked required-before-promotion');
    if (plaintextSecret) errors.push('production manifests contain a plaintext secret-like value instead of an external reference');
    report('EXTERNAL_SECRETS', plaintextSecret ? 'FAIL' : 'PASS');
  }

  if (hasFlag('--forbid-retroactive-backfill')) {
    const backfillPattern = /(?:backfill|retroactive|historical).{0,80}(?:order|shipping|shipment)|(?:order|shipping|shipment).{0,80}(?:backfill|retroactive|historical|recalculat)/i;
    if (backfillPattern.test(changed)) errors.push('changed lines contain a retroactive order/shipping backfill or recalculation');
    report('RETROACTIVE_ORDER_BACKFILL', backfillPattern.test(changed) ? 'FAIL' : 'PASS');
  }

  const forbiddenImplementation = /(?:new\s+payment\s+provider|create\s+new\s+microservice)/i.test(changed);
  if (forbiddenImplementation) errors.push('changed lines claim a forbidden new provider or microservice');
  report('FORBIDDEN_IMPLEMENTATION', forbiddenImplementation ? 'FAIL' : 'PASS');

  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    console.error(`FAIL: scope verification found ${errors.length} issue(s)`);
    process.exitCode = 1;
    return;
  }
  console.log('PASS: requested scope constraints hold for the inspected plan, production configuration, and changed lines');
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
}

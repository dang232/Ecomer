#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import { dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(MODULE_PATH), '..');

function webhookBlocks(config) {
  return [...config.matchAll(/webhook_configs:\s*([\s\S]*?)(?=\n\s*-\s+name:|\n\s*inhibit_rules:|\s*$)/g)].map(
    ([, block]) => block,
  );
}

export function validateAlertmanagerConfig(config, environment = 'prod') {
  const errors = [];
  const isDev = environment.toLowerCase() === 'dev' || environment.toLowerCase() === 'development';

  if (!isDev && /localhost:9999/i.test(config)) {
    errors.push('localhost:9999 receiver is allowed only in dev');
  }

  if (!isDev) {
    const blocks = webhookBlocks(config);
    if (blocks.length === 0) {
      errors.push('no webhook receiver was found');
    }
    blocks.forEach((block, index) => {
      if (!/\burl_file:\s*\S+/.test(block)) {
        errors.push(`webhook receiver ${index + 1} must use url_file`);
      }
      if (/\burl:\s*\S+/.test(block)) {
        errors.push(`webhook receiver ${index + 1} must not contain an inline url`);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`Alertmanager configuration validation failed: ${errors.join('; ')}`);
  }
}

async function configFilesFor(input) {
  const path = resolve(ROOT, input ?? 'infra/k8s/overlays/prod');
  const entry = await stat(path);
  if (entry.isFile()) return [{ path, environment: basename(dirname(path)) }];

  const environment = basename(path);
  const files = [
    { path: resolve(ROOT, 'infra/alertmanager/alertmanager.yml'), environment },
  ];
  if (environment !== 'dev' && environment !== 'development') {
    files.push({ path: resolve(ROOT, 'infra/k8s/base/monitoring.yaml'), environment });
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  try {
    const files = await configFilesFor(process.argv[2]);
    for (const file of files) {
      validateAlertmanagerConfig(await readFile(file.path, 'utf8'), file.environment);
    }
    console.log(`Alertmanager configuration valid for ${files[0].environment}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Alertmanager configuration validation failed');
    process.exitCode = 1;
  }
}

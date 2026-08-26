import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { analyzeForbiddenProviders } from './verify-scope.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const fixturePath = (name) => join(testDirectory, 'fixtures', 'verify-scope', name);

async function fixture(name) {
  return readFile(fixturePath(name), 'utf8');
}

test('disabled provider policy mentions are not enablement', async () => {
  const text = await fixture('disabled-policy.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: text, changedConfigText: '' }), []);
});

test('explicit enabled environment values are rejected', async () => {
  const text = await fixture('enabled-env.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: text, changedConfigText: '' }), ['momo']);
});

test('nested enabled provider configuration is rejected', async () => {
  const text = await fixture('nested-enabled-provider.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: text, changedConfigText: '' }), ['momo']);
});

test('comment-only provider policy text is not enablement', async () => {
  const text = await fixture('comment-only-policy.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: text, changedConfigText: '' }), []);
});

test('live provider lists are rejected', async () => {
  const text = await fixture('live-provider-list.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: text, changedConfigText: '' }), ['momo', 'vnpay']);
});

test('provider arrays are treated as live provider lists', async () => {
  const text = await fixture('provider-array.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: text, changedConfigText: '' }), ['momo', 'vnpay']);
});

test('disabled provider entries in a provider map are not rejected', async () => {
  const text = await fixture('disabled-provider-map.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: text, changedConfigText: '' }), []);
});

test('forbidden default provider selection is rejected', async () => {
  const text = await fixture('default-provider.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: text, changedConfigText: '' }), ['vnpay']);
});

test('changed non-production provider configuration requires a gate', async () => {
  const text = await fixture('ungated-changed-config.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: '', changedConfigText: text }), ['momo']);
});

test('explicitly gated non-production provider configuration is accepted', async () => {
  const text = await fixture('gated-changed-config.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: '', changedConfigText: text }), []);
});

test('explicitly gated changed provider list is accepted outside production', async () => {
  const text = await fixture('gated-provider-list.txt');

  assert.deepEqual(analyzeForbiddenProviders({ productionText: '', changedConfigText: text }), []);
});

test('provider names are treated as literal text', () => {
  const text = 'MOMO_ENABLED=true';

  assert.deepEqual(
    analyzeForbiddenProviders({ productionText: text, changedConfigText: '', providers: ['momo.*'] }),
    [],
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAlertmanagerConfig } from './check-alertmanager-config.mjs';

const secretBackedConfig = `
receivers:
  - name: operations
    webhook_configs:
      - url_file: /etc/alertmanager/secrets/webhook-url
`;

test('production config rejects the development null receiver', () => {
  assert.throws(
    () => validateAlertmanagerConfig("webhook_configs:\n  - url: 'http://localhost:9999/dev-null'", 'prod'),
    /localhost:9999.*allowed only in dev/i,
  );
});

test('production config requires secret-backed webhook URLs', () => {
  assert.throws(
    () => validateAlertmanagerConfig('webhook_configs:\n  - url: https://alerts.example.test', 'prod'),
    /url_file/i,
  );
});

test('development config may use a local null receiver', () => {
  assert.doesNotThrow(() => validateAlertmanagerConfig(
    "webhook_configs:\n  - url: 'http://localhost:9999/dev-null'",
    'dev',
  ));
});

test('secret-backed production config passes without inspecting secret contents', () => {
  assert.doesNotThrow(() => validateAlertmanagerConfig(secretBackedConfig, 'prod'));
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractActions,
  parseOptions,
  summarizeTestLogs,
} = require('./ci_monitor.cjs');

test('extractActions returns unique external actions', () => {
  const workflow = `
steps:
  - uses: actions/checkout@v6
  - uses: ./local-action
  - uses: actions/checkout@v6
  - uses: dorny/paths-filter@v4
`;

  assert.deepEqual(extractActions(workflow), [
    { repository: 'actions/checkout', ref: 'v6' },
    { repository: 'dorny/paths-filter', ref: 'v4' },
  ]);
});

test('parseOptions separates positional values and flags', () => {
  assert.deepEqual(
    parseOptions(['123', '--branch', 'main', '--limit', '5']),
    {
      positional: ['123'],
      flags: { branch: 'main', limit: '5' },
    },
  );
});

test('summarizeTestLogs keeps test result lines and removes duplicates', () => {
  const logs = [
    'Tests run: 26, Failures: 0, Errors: 0, Skipped: 0',
    'Test Files  79 passed (79)',
    'Tests  554 passed (554)',
    'Tests  554 passed (554)',
  ].join('\n');

  assert.deepEqual(summarizeTestLogs(logs), [
    'Tests run: 26, Failures: 0, Errors: 0, Skipped: 0',
    'Test Files  79 passed (79)',
    'Tests  554 passed (554)',
  ]);
});

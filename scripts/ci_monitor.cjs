#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HELP = `Usage: node scripts/ci_monitor.cjs <command> [arguments]

Commands:
  runs [--branch <name>] [--limit <count>]       List recent workflow runs
  watch <run-id>                                 Watch a run until completion
  fail-fast <run-id>                             Watch a run and return its result
  log-failed <run-id>                            Print logs for failed jobs
  test-summary <run-id>                          Print test result lines from run logs
  check-actions [workflow-file] [--pins]         Check versions and print latest pins
  resolve-action <owner/repo> [tag]              Resolve a release tag to an immutable SHA
  grep <run-id> --pattern <regex>                Search all run logs
  wait-for <run-id> <job> --keyword <text>       Wait for a job and verify its logs

Options for wait-for:
  --timeout <minutes>                            Default: 30
  --interval <seconds>                           Default: 10
`;

function parseOptions(args) {
  const positional = [];
  const flags = {};

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }

    const key = value.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }

  return { positional, flags };
}

function extractActions(workflow) {
  const actions = new Map();
  const matcher = /^\s*-?\s*uses:\s*['"]?([^'"\s#]+)['"]?/gm;
  let match;

  while ((match = matcher.exec(workflow)) !== null) {
    const specifier = match[1];
    if (specifier.startsWith('./') || specifier.startsWith('docker://')) {
      continue;
    }

    const separator = specifier.lastIndexOf('@');
    if (separator <= 0) {
      continue;
    }

    const repository = specifier.slice(0, separator);
    const ref = specifier.slice(separator + 1);
    actions.set(`${repository}@${ref}`, { repository, ref });
  }

  return [...actions.values()];
}

function summarizeTestLogs(logs) {
  const resultPatterns = [
    /Tests run:\s*\d+/i,
    /^\s*Test Files\s+\d+/i,
    /^\s*Tests\s+\d+\s+(?:passed|failed)/i,
    /^\s*\d+\s+tests?\s+passed/i,
    /All tests passed/i,
    /BUILD (?:SUCCESS|FAILURE)/,
  ];

  return [
    ...new Set(
      logs
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => resultPatterns.some((pattern) => pattern.test(line))),
    ),
  ];
}

function runGh(args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    const detail = capture ? result.stderr.trim() : '';
    throw new Error(`gh ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }

  return capture ? result.stdout : '';
}

function requireValue(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function listWorkflowFiles(file) {
  if (file) {
    return [path.resolve(file)];
  }

  const directory = path.resolve('.github', 'workflows');
  return fs
    .readdirSync(directory)
    .filter((entry) => /\.ya?ml$/i.test(entry))
    .map((entry) => path.join(directory, entry));
}

function latestRelease(repository) {
  return runGh(
    ['api', `repos/${repository}/releases/latest`, '--jq', '.tag_name'],
    { capture: true },
  ).trim();
}

function resolveActionSha(repository, ref) {
  let object = JSON.parse(
    runGh(
      [
        'api',
        `repos/${repository}/git/ref/tags/${encodeURIComponent(ref)}`,
      ],
      { capture: true },
    ),
  ).object;

  while (object.type === 'tag') {
    object = JSON.parse(
      runGh(
        ['api', `repos/${repository}/git/tags/${object.sha}`],
        { capture: true },
      ),
    ).object;
  }

  return object.sha;
}

function majorOf(ref) {
  const match = /^v?(\d+)/.exec(ref);
  return match ? Number(match[1]) : null;
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function commandRuns(flags) {
  const args = [
    'run',
    'list',
    '--limit',
    String(flags.limit || 20),
    '--json',
    'databaseId,workflowName,displayTitle,headBranch,status,conclusion,url,createdAt',
  ];
  if (flags.branch) {
    args.push('--branch', String(flags.branch));
  }

  const runs = JSON.parse(runGh(args, { capture: true }) || '[]');
  console.log(JSON.stringify(runs, null, 2));
}

function commandCheckActions(file, flags = {}) {
  const usages = new Map();

  for (const workflowFile of listWorkflowFiles(file)) {
    const workflow = fs.readFileSync(workflowFile, 'utf8');
    for (const action of extractActions(workflow)) {
      const current = usages.get(action.repository) || new Set();
      current.add(action.ref);
      usages.set(action.repository, current);
    }
  }

  let hasRisk = false;
  for (const [repository, refs] of [...usages.entries()].sort()) {
    let latest;
    try {
      latest = latestRelease(repository);
    } catch (error) {
      console.log(`${repository}: unable to resolve latest release (${error.message})`);
      hasRisk = true;
      continue;
    }

    const latestPin = flags.pins
      ? ` -> ${repository}@${resolveActionSha(repository, latest)} # ${latest}`
      : '';

    for (const ref of [...refs].sort()) {
      const isSha = /^[0-9a-f]{40}$/i.test(ref);
      const isMutable = !isSha && majorOf(ref) === null;
      const isCurrentMajor =
        isSha || (majorOf(ref) !== null && majorOf(ref) === majorOf(latest));
      const state = isMutable
        ? 'MUTABLE'
        : isCurrentMajor
          ? 'OK'
          : 'OUTDATED';
      console.log(`${state.padEnd(8)} ${repository}@${ref} (latest ${latest})${latestPin}`);
      hasRisk ||= state !== 'OK';
    }
  }

  if (hasRisk) {
    process.exitCode = 1;
  }
}

function commandWaitFor(runId, jobName, flags) {
  const timeoutMs = Number(flags.timeout || 30) * 60 * 1000;
  const intervalMs = Number(flags.interval || 10) * 1000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const payload = JSON.parse(
      runGh(['run', 'view', runId, '--json', 'jobs'], { capture: true }),
    );
    const job = payload.jobs.find((candidate) =>
      candidate.name.toLowerCase().includes(jobName.toLowerCase()),
    );

    if (!job) {
      console.log(`Waiting for job matching "${jobName}"...`);
      sleep(intervalMs);
      continue;
    }

    console.log(`${job.name}: ${job.status}${job.conclusion ? `/${job.conclusion}` : ''}`);
    if (job.status !== 'completed') {
      sleep(intervalMs);
      continue;
    }

    if (flags.keyword) {
      const logs = runGh(
        ['run', 'view', runId, '--job', String(job.databaseId), '--log'],
        { capture: true },
      );
      if (!logs.includes(String(flags.keyword))) {
        throw new Error(
          `Job completed without required keyword: ${String(flags.keyword)}`,
        );
      }
    }

    if (job.conclusion !== 'success') {
      process.exitCode = 1;
    }
    return;
  }

  throw new Error(`Timed out waiting for job matching "${jobName}"`);
}

function main(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    console.log(HELP);
    return;
  }

  const { positional, flags } = parseOptions(rest);
  const runId = positional[0];

  switch (command) {
    case 'runs':
      commandRuns(flags);
      break;
    case 'watch':
    case 'fail-fast':
      runGh([
        'run',
        'watch',
        requireValue(runId, `${command} requires <run-id>`),
        '--exit-status',
        '--interval',
        String(flags.interval || 10),
      ]);
      break;
    case 'log-failed':
      runGh([
        'run',
        'view',
        requireValue(runId, 'log-failed requires <run-id>'),
        '--log-failed',
      ]);
      break;
    case 'test-summary': {
      const logs = runGh(
        ['run', 'view', requireValue(runId, 'test-summary requires <run-id>'), '--log'],
        { capture: true },
      );
      const summary = summarizeTestLogs(logs);
      console.log(summary.length ? summary.join('\n') : 'No test summary lines found.');
      break;
    }
    case 'check-actions':
      commandCheckActions(positional[0], flags);
      break;
    case 'resolve-action': {
      const repository = requireValue(
        positional[0],
        'resolve-action requires <owner/repo>',
      );
      const ref = positional[1] || latestRelease(repository);
      console.log(`${repository}@${resolveActionSha(repository, ref)} # ${ref}`);
      break;
    }
    case 'grep': {
      const pattern = requireValue(flags.pattern, 'grep requires --pattern <regex>');
      const logs = runGh(
        ['run', 'view', requireValue(runId, 'grep requires <run-id>'), '--log'],
        { capture: true },
      );
       const escapedPattern = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       const matcher = new RegExp(escapedPattern, 'i');
      const matches = logs.split(/\r?\n/).filter((line) => matcher.test(line));
      console.log(matches.join('\n'));
      if (!matches.length) {
        process.exitCode = 1;
      }
      break;
    }
    case 'wait-for':
      commandWaitFor(
        requireValue(runId, 'wait-for requires <run-id>'),
        requireValue(positional[1], 'wait-for requires <job>'),
        flags,
      );
      break;
    default:
      throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  }
}

module.exports = {
  extractActions,
  parseOptions,
  summarizeTestLogs,
};

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`ci_monitor: ${error.message}`);
    process.exitCode = 1;
  }
}

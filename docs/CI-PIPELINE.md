# VNShop CI Pipeline

Updated: 2026-07-16

## Required Check

Branch protection should require exactly:

```text
VNShop CI / CI Gate
```

`CI Gate` is always created, including documentation-only pull requests. It accepts intentionally skipped path-specific jobs and fails when any selected job fails, is cancelled, or does not complete.

## Event Flow

| Event                                 | Behavior                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Pull request to `main`                | Runs repository checks and every affected application or service stack. Container builds are skipped.   |
| Push to `main` or `release/**`        | Runs affected checks, then builds and scans changed service images before the gate passes.              |
| Manual dispatch                       | Runs all application surfaces, all 19 services, protobuf checks, and container scans.                   |
| Mobile push to `main` or `release/**` | The separate Flutter artifact workflow validates the app and publishes Android debug and web artifacts. |
| Weekly schedule                       | The backup workflow starts only the required Postgres services and verifies backup/restore behavior.    |

A change to `.github/workflows/ci.yml` selects every stack so pipeline edits validate the complete job graph.

## Job Ownership

- `Repository checks`: shell and Node syntax, CI monitor tests, design-token generator tests, and Keycloak JSON parsing.
- `React application`: `npm ci` followed by `npm run verify`, which includes typecheck, lint, i18n parity, token enforcement, formatting, Vitest, and a production build.
- `Flutter application`: dependency resolution, analysis, tests with coverage output, and an Android debug build.
- `Java unit tests (...)`: isolated non-Docker unit suites for each changed Maven service.
- `Node service (...)`: non-mutating ESLint debt audit, required Jest tests with coverage reporting when a service declares a local runner, and a required NestJS build. Lint remains visible but non-blocking until the existing service-level debt is cleared; services without Jest emit an explicit notice.
- `Python service (video-moderator)`: dependency installation, bytecode compilation, and pytest.
- `Protobuf compatibility`: Buf lint and breaking-change detection against the pull-request base.
- `Container scan (...)`: changed-service image build plus Trivy HIGH/CRITICAL scan on trusted branch pushes and manual runs.

## Coverage Boundary

The previous workflow labelled an echo-only job as a coverage gate while invoking Maven with `-Djacoco.skip=true`. That claim has been removed.

Java CI currently runs isolated unit tests with integration, Pact, application-context, and selected gRPC suites excluded. JaCoCo remains skipped for this lane so it does not misrepresent partial-suite coverage. The dedicated `VNShop Java Coverage` workflow in `.github/workflows/ci-coverage.yml` is the separate reproducible lane: it runs every Java service with JaCoCo enabled, enforces 90% `LINE` and 90% `BRANCH` `COVEREDRATIO` checks, captures Maven output with `pipefail`/`tee`, and uploads each service's HTML/XML report.

Reproduce a service gate locally with:

```bash
set -euo pipefail
mvn --batch-mode --no-transfer-progress \
  -f services/product-service/pom.xml \
  -DskipTests=false -Djacoco.skip=false \
  clean verify 2>&1 | tee product-service-coverage.log
```

Validate all Java POMs and workflow wiring with:

```bash
node --test scripts/coverage/validate-java-coverage-config.test.mjs
```

The checked-in below-threshold fixture proves the gate fails on real JaCoCo output:

```bash
set -o pipefail
mvn --batch-mode --no-transfer-progress clean verify \
  -DskipTests=false -Djacoco.skip=false \
  2>&1 | tee scripts/coverage/fixtures/below-threshold/failure-coverage.log
```

Node services run Jest with `--coverage`, but existing per-package thresholds are not enforced yet because messaging-service is below its declared baseline despite all tests passing. Test failures remain blocking. Notification currently uses `--forceExit` after its suite because an open async handle otherwise prevents Jest from terminating; the job emits a notice so this debt stays visible. Flutter emits `coverage/lcov.info` during its test job.

## Action Security

All external actions are pinned to full release commit SHAs. Inline comments retain the human-readable release tag. Dependabot checks the `github-actions` ecosystem weekly and proposes pin updates.

The workflow token defaults to read-only access. CD grants `packages: write` only to image publication and `contents: write` only to the manifest update job.

## Local Verification

These commands do not require Docker:

```bash
node --test scripts/ci_monitor.test.cjs scripts/generate-design-tokens.test.mjs
node scripts/ci_monitor.cjs --help
node scripts/ci_monitor.cjs check-actions

cd fe
npm run verify

cd ../vnshop_mobile
flutter analyze
flutter test
flutter build apk --debug
```

Use each service's Maven, npm, or pytest command to reproduce a selected matrix entry. Docker-backed container scans and end-to-end infrastructure tests run only where Docker use is explicitly allowed.

## Run Triage

```bash
node scripts/ci_monitor.cjs runs --branch <branch>
node scripts/ci_monitor.cjs watch <run-id>
node scripts/ci_monitor.cjs log-failed <run-id>
node scripts/ci_monitor.cjs test-summary <run-id>
node scripts/ci_monitor.cjs grep <run-id> --pattern <regex>
```

The monitor wraps the authenticated GitHub CLI and emits observable output suitable for local use and automation.

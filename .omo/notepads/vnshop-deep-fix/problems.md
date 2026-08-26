# Problems - vnshop-deep-fix

- ## [2026-08-25] Task: 28
  - This file was absent when Task 28 started. Runtime blockers are also recorded in `issues.md`: no local authenticated broker fixture was run, WSL `/bin/bash` is unavailable, and Git Bash lacks `flock`.

- ## [2026-08-25] Task: 22
  - No new runtime problem beyond the Redis/Docker and k6 availability blockers recorded in `issues.md`; implementation verification uses focused Java tests, source scans, and Node syntax checks.

- ## [2026-08-26T00:06:49.4952795+07:00] Task: 30
  - No new runtime blocker beyond unavailable ast-grep, TypeScript LSP, and live browser noted in issues.md.


 - ## [2026-08-26T01:09:40.9280984+07:00] F1/F4 tooling repair
   - No new implementation problem was introduced. Remaining release blockers are pre-existing and remain recorded in issues.md/F2/F3; the new verifiers intentionally report only their requested structural and scope predicates.

- ## [2026-08-26] Task: F2 repair wave
  - No new implementation blocker. Remaining F2 rejection items are baseline/external gates documented in `F2.log`; introduced FE, proto invocation, product, gateway, payment, and order compile regressions were repaired with focused evidence.

 - ## [2026-08-26T01:35:15.8873694+07:00] F2 concrete gate repair
   - No new implementation blocker. The required scanner now runs, but the full repository remains rejected by existing oversized production files and generic catches; no checks were weakened.

  - ## [2026-08-26T02:06:30+07:00] F2 task-owned quality repair
   - Order production compile and shipping production compile pass after the scoped splits and catch narrowing.
   - The focused `SagaOrchestratorTest` invocation remains blocked during test compilation by the pre-existing ambiguous `KafkaTemplate.send` call in `BrokerFailureDltReplayTest.java:57`; the unrelated test was not changed.
    - LSP diagnostics timed out in the Java daemon; Maven compile and static scanner evidence are the verification fallback.

  - ## [2026-08-26] F3 order-service DLT selector repair
    - The previously recorded `BrokerFailureDltReplayTest.java:57` overloaded `KafkaTemplate.send` compilation blocker was repaired in the test by selecting the concrete `(topic, key, payload)` overload.
    - No live broker/DLT runtime was run; the focused unit selector passed 3/3 and proves the mocked durable replay and claim-release paths only.
     - Java LSP diagnostics timed out; Maven clean compile and focused test execution supplied the verification evidence.

 - ## [2026-08-26] Task F4 provider-scope verifier false-rejection repair
   - TypeScript LSP diagnostics remain unavailable because the TypeScript server is not installed and installation was previously declined; `node --check` and the executable Node test suite are the fallback.
   - The exact scope command still emits pre-existing Git CRLF normalization warnings while reading the dirty worktree diff; it exits 0 and all scope predicates pass.
  - The verifier intentionally does not claim live registry, runtime, secret-material, or unrelated service-test health; this change is limited to semantic provider-scope detection.

- ## [2026-08-26] Final FE/mobile verification continuation
   - Repository-owned frontend and mobile gates pass: FE typecheck, Vitest, build, scoped lint/format checks, ImageWithFallback regression, Flutter analyze, and Flutter tests.
   - Playwright discovery passes and the checkout provider-bearing selector resolves 3 tests, but live Chromium execution remains blocked because no Docker services are running and both `localhost:3000` and `localhost:8080` refuse connections.
   - No live browser, accessibility, checkout-provider, or gateway result is claimed until the stack is started successfully.

 - ## [2026-08-26] CI continuation
   - `VNShop CI`, `CodeQL`, and `Observability validation` passed for `f4d29355`.
   - `VNShop Broker Reliability` reached the focused suites and failed because Maven used JDK 17 while all Java services enforce Java 25. The Python fixtures and datastore checks passed before Maven started.
   - Added an uncommitted `actions/setup-java` Temurin 25 step to `.github/workflows/ci-reliability.yml`, matching the Java coverage and CodeQL workflows. YAML LSP diagnostics and `git diff --check` pass.
   - `VNShop Java Coverage` executed all 266 tests but correctly rejected the unchanged 90% line/branch policy at 62% line and 46% branch coverage. The JaCoCo CSV shows broad deficits across adapters, controllers, repositories, configuration, and video/review paths; no coverage gate was weakened.

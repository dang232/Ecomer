# Learnings — vnshop-enterprise-hardening-20m-load

Conventions, patterns, and successful approaches discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

- Todo 1 canonical captures: workspace preservation was captured before detached verification; detached capture is bound to commit b5a84516009008e2940336925dd8381b1231dd5a/tree 0565a2a0468c0a46aa69c8c434f0f4a1b2552c4d. 
- Focused contract suite passes 5 tests. Windows subprocess output can emit an access-violation diagnostic while pytest still exits 0; evidence records remain valid.

- Independent verification repair: capture-detached now verifies actual HEAD/tree identity and rejects dirty repositories before hashing. Clean detached baseline at commit 32b35afff0c6f24fa2c928fd7d96e88a5fdac009 reports repository_status=PASS.

- Todo 2 strict policy is now wired into the release validator CLI. Production correctly rejects the current zero-digest, placeholder-origin, stub/demo-mode, SASL_PLAINTEXT, insecure Elasticsearch, and empty-SealedSecret graph; dev-only unresolved/unsealed flags remain explicit.
- Exact requested pytest filename `validate-k8s-release.test.py` is not importable by stock pytest while `validate-k8s-release.py` exists; direct unittest execution passes 7 tests and the existing pytest validator suite passes 3 tests.
- Repair pass added the package import shim under `infra/scripts/validate-k8s-release/`; the exact pytest command now passes 7 tests. Plan, quality, scope, and evidence helper interfaces were expanded to their F1/F2/F4 contracts.
- Scoped self-review repaired canonical render binding, behavioral hostile-evidence fixtures, dual-capture scope validation, strict plan/quality interfaces, structured provenance checks, and production Kafka/Elasticsearch policy predicates.
- Todo 3 secure Kafka authority renders successfully with `kubectl kustomize infra/k8s/overlays/prod --load-restrictor LoadRestrictionsNone`: one Kafka StatefulSet, RF3/min ISR2 contract, secure listener markers, PVCs, spread, PDB, and digest-pinned broker/bootstrap images. Inventory validation passes 39 topics, 15 client/admin rows, and 171 reassignment partitions.
- Follow-up review repair committed as `6934faf3`: strict evidence schema validation, canonical production render binding, structured Kafka/Elasticsearch predicates, and load-restrictor release rendering now run against authenticated inputs rather than caller-selected authorities.
- Focused Todo 3 contract tests pass 6 tests, including malformed RF1 inventory, duplicate/identity checks, production-target rejection, missing-principal rejection, cluster mismatch, and authenticated-cluster absence blocking.
- Independent-verifier repair: Kafka drill now rejects explicit `PLAINTEXT://` and `SASL_PLAINTEXT://` endpoints before identity or external-cluster handling; bare service DNS remains valid and proceeds to authenticated-cluster gating.
- Inventory/bootstrap parity now checks the local bootstrap authority marker, `SASL_SSL`, `kafka-admin`, RF3, and local-target fail-closed behavior. The Kubernetes bootstrap ConfigMap carries the same authority marker and admin identity.
- Repaired Todo 3 focused suite passes 9 tests; secure production render inventory and topology contract both pass after the parallel Elasticsearch authority became available.

- Lost canonical evidence was not recoverable from the approved external root; prior attempts were marked INCONCLUSIVE. Fresh attempt attempt-20260820T121557Z-2d68c8cd binds new dual captures to commit 6b4b84539e4946bd4c828afd30b770d2e28ae067/tree bf3291e1ede62b395b14151ca4f7e8455a381c1e.

- Final Todo 1 repair replaced all matrix help/version placeholders with behavioral contract checks, corrected F3 to use node, and corrected Todo 7 to provider-isolation-preflight.py. Fresh active attempt is attempt-20260820T130949Z-816861b1.

- Final matrix repair: all task-1 through task-7, F3, and F4 cases now execute behavioral checks; F3 uses node --check for e2e-day.mjs, and task-7 references provider-isolation-preflight.py. Active attempt attempt-20260820T131218Z-b4d042b1 has report/checkpoint only and no final barrier.

- Phase-1 repair completed: matrix commands now reference behavioral task-owned tests/CLI paths, final-tree barrier semantics are independent from initial run identity, timestamps are timezone-parsed, and verify-final returns nonzero for NO-GO.

- Final lifecycle repair separates initial Todo 1 binding, per-task immutable bindings, and final F1-F4 barrier bindings. Barrier hashes task 1-7 checkpoints and raw telemetry gate entries drive production status.

- Final review repair added strict repository-commit/tree provenance, shared deterministic seal/verify derivation, and expected-negative runner outcomes.

- Todo 2 rescue adds caller-supplied evidence validation with path-root and SHA-256 checks, complete Git tree/worktree scope comparison, recursive quality inventories, row-local plan contracts, canonical prod render binding, and structured topology/provenance checks. Focused Todo 2 tests pass 11 cases.
- Todo 2 repair hardens gate-specific owner/producer bindings, external attestation URI formats, real evidence manifest/artifact digest binding, complete hostile evidence fixtures, all origin values, symlink transitions, canonical topology helper binding, and ignored-cache exclusion. Focused Todo 2 tests pass 28 with one Windows symlink-capability skip.

- Todo 1 consumer trust repair: gate evidence now requires exact matrix owner/producing_system/authority and structured HTTPS provider IDs derived from those fields; arbitrary provider-issued IDs cannot drive GO.

- Todo 2 final scope repair adds a fail-closed state table in `scope_gate.compare_entries()`: captured regular-file disappearance and every captured/file-type substitution are errors even when allowlisted, while genuinely new allowlisted files and byte-identical pre-existing dirty files retain their classifications. Direct dictionary tests avoid Windows symlink privilege requirements; the optional real symlink test remains.

- Todo 3 verification: focused Kafka/video-moderator contracts pass 16; Python compilation passes; inventory validation reports 39 topics, 15 identities, and 171 reassignment partitions; the guarded broker-loss drill remains `BLOCKED_EXTERNAL` without Docker or an authenticated cluster.

- Todo 4 verification: focused Elasticsearch contracts pass 5; Python compilation, production render, and topology contract pass; the render contains 150 resources including one Elasticsearch StatefulSet; the guarded node-loss drill returns `BLOCKED_EXTERNAL` without an authenticated cluster, while production-target input is rejected.
- Todo 3 remediation (2026-08-21): focused Kafka/video infrastructure contracts pass 22; search/recommendations custom KafkaAdmin and lag AdminClient paths now reuse Spring Boot KafkaProperties/KafkaAdmin security properties; Java producer configs now declare `acks=all` and idempotence on durable producer services; KafkaJS clients use shared fail-closed TLS/SASL boundaries with explicit local plaintext mode only.
- Todo 3 remediation inventory validation passes 39 topics, 15 identities, and 171 reassignment partitions; local bootstrap topic metadata and Kubernetes embedded bootstrap topic/ACL sets are now mechanically compared by the inventory contract.

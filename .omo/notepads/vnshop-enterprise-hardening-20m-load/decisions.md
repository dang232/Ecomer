# Decisions — vnshop-enterprise-hardening-20m-load

Architectural choices and rationales discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

- Todo 1 keeps aggregate/seal/verify-final coordinator-only and rejects any production GO claim before seal. Docker-unavailable readiness is recorded BLOCKED_EXTERNAL with production_status NO-GO.

- Superseded pre-implementation attempts remain external and are marked INCONCLUSIVE; canonical attempt is attempt-20260820T103935Z-6b112282. Production remains NO-GO and Docker is BLOCKED_EXTERNAL.

- Todo 2 does not modify Kafka, Elasticsearch, backup, or Todo 1 files. The topology helper reports the current insecure graph as FAIL so Todo 3/4 can consume the contract without weakening it.
- `quality_gate.py` uses `sys.executable` so its checks run in the same environment as the invoking verifier; it reports FAIL when the current strict production graph is unsafe.
- Canonical render helpers always invoke `kubectl kustomize infra/k8s/overlays/prod --load-restrictor LoadRestrictionsNone`; caller-supplied manifests are accepted only when byte-identical to that render.
- Follow-up commit preserves Todo 2 ownership and does not touch Todo 3/4 topology files; current canonical render is the sole authority for inventory and topology checks.
- Todo 3 selects `infra/k8s/kafka/kafka-statefulset.yaml` as the sole production Kafka authority and removes the embedded one-broker resource from `platform-services.yaml`; local Compose/test Kafka remains outside the production render.
- The selected Kafka manifest is referenced cross-directory with `--load-restrictor LoadRestrictionsNone` because Kustomize's default load restriction rejects the plan-mandated `infra/k8s/base` to `infra/k8s/kafka` authority path; no alternate production overlay was introduced.

- Evidence lifecycle now implements create-barrier, aggregate, seal, and verify-final. Aggregate requires exactly one checkpoint for 1-7/F1-F4; seal recomputes NO-GO when any production evidence is absent or blocked.

- Active attempt was recreated after allowed-path and owner mapping changes. No barrier/aggregate/sealed output exists for the active incomplete plan; final barrier remains coordinator-owned for post-Todo-8 commit/tree.

- Final owner map: Todo 1 runtime-qa-owner; Todo 2 release-engineering-owner; Todo 3/4 platform-operations-owner; Todo 5 disaster-recovery-owner; Todo 6/7 capacity-test-owner; F1 plan-compliance-owner; F2 code-quality-owner; F3 runtime-qa-owner; F4 scope-fidelity-owner.

- Final active attempt recreated after lifecycle/matrix changes: attempt-20260820T132100Z-b29b87b6, bound to 928f3225e220010007517700e9f8a5f2b0c68ec8/4c0f40718459fcfd9708af286ab41c9da2a8ff8a. No final barrier or seal is permitted before Todos 1-8.

- Final active attempt after deadlock repair: attempt-20260820T132730Z-fbccabc5, commit 1513b640ff7f0570de862fb2af12e56cd4264419/tree afed19587425f79c2a9cef8c11e7ee4e19497cd3. No final barrier/aggregate/seal created.

- Todo 2 rescue keeps canonical production Kustomize as the only render authority and treats the existing external evidence root as input; no Todo 1 runner/matrix or Todo 3/4 topology files are changed.

- Final Todo 1 commits: a3788271d1384c7f8f6b520509cc407c42e5299d and f0479ffb495ea18ad805186f70c8801a1d2d4878. Canonical final attempt: attempt-20260821T052827Z-62f9adf5, commit f0479ffb495ea18ad805186f70c8801a1d2d4878, tree d201c4747531591e0bd615f6d600e864c92b9650.
- Todo 2 repair keeps Todo 1 immutable: gate-matrix compatibility is solved by explicit per-gate definitions in production-gates.yaml and direct consumer regression tests, while evidence_session.py, the runner, matrix, and schemas remain unchanged.

- Reopened Todo 1 trust fix commit: 2ca2e81dafca13513d5b397177f1100ce9af1aa2. Fresh canonical attempt: attempt-20260821T081313Z-70156019, bound to tree c063c090b2e542e1c5ed3e9c3bc733958999d615; prior attempt attempt-20260821T053701Z-d8b36398 marked INCONCLUSIVE/superseded.

- Todo 2 follow-up commit `46a671f3` contains only `scope_gate.py` and its direct behavioral tests; the fresh task-2 report/checkpoint is bound to its repository commit/tree and keeps production `NO-GO`.

- Todo 3 commit `a92401e9f99f88d0828df8ae9de5304b8853b676` selects the hardened three-broker KRaft StatefulSet as the sole production Kafka authority, removes the embedded one-broker resource, and binds the task report/checkpoint to tree `2513c52304e7fec214591ce5311373581e86fb10`.

- Todo 4 commit `27368079f72c5ba42428686697e2262178b98072` selects the self-managed three-node Elasticsearch StatefulSet as the sole production authority, removes the embedded single-node resource, and binds the task report/checkpoint to tree `be498d62565e3820306e94aa06e07667b082b2f3`.
- Todo 3 remediation decision (2026-08-21): custom Java KafkaAdmin beans use `KafkaProperties.buildAdminProperties()` and health AdminClients use the resulting `KafkaAdmin.getConfigurationProperties()` rather than maintaining parallel security maps. Application-owned RF1 topic declarations were removed from inventory/payment admin configs; canonical inventory/bootstrap remains the production topic authority.

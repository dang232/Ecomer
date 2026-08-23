# Problems — vnshop-enterprise-hardening-20m-load

Unresolved blockers and technical debt discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

- External prerequisite: Docker Desktop daemon is unavailable. The readiness baseline therefore records BLOCKED_EXTERNAL; no runtime or production PASS is claimed.

- No new repository blocker. Docker Desktop remains unavailable, so runtime readiness is BLOCKED_EXTERNAL despite repository-static PASS.

- External/runner prerequisite remains unavailable for Todo 2: canonical matrix lacks task-2 scenarios. Argo/live cluster UID, desired/resolved revision, promotion-run, and rendered/live digest evidence are not fabricated and remain NO-GO.
- Scope comparison detects 22 unrelated paths whose hashes differ from the original workspace capture; these are preserved and reported, not reverted. Production remains NO-GO and repository status is FAIL until the coordinator resolves scope fidelity.
- Current canonical attempt remains externally blocked for task-2 happy execution because the Todo 1 matrix's first strict command fails against unrelated dirty topology changes; no production or external runtime claim was made.
- `python infra/scripts/k8s-topology-contract.py --manifest <prod-render>` remains FAIL only on the pre-existing Elasticsearch `single-node` marker owned by Todo 4; Kafka inventory/render checks pass. No Todo 4 file was changed.
- Docker/real authenticated Kafka cluster is unavailable; failure drill correctly returns BLOCKED_EXTERNAL and does not claim broker-loss success. SealedSecret encrypted data and certificate/key material remain external and absent.
- Registry lock/provenance, SealedSecret material, certificates, Argo state, and live cluster identity remain unavailable external prerequisites; production remains NO-GO.
- Canonical attempt `attempt-20260820T103935Z-6b112282` still has no `run.json` or prechange captures in the external root; `evidence_session.py checkpoint` must remain uncalled/blocked rather than fabricated.

- Docker remains unavailable. Fresh Todo 1 baseline is repository_status=PASS, status=BLOCKED_EXTERNAL, production_status=NO-GO. Original pre-plan scope fidelity is unrecoverable and superseded attempts are INCONCLUSIVE.

- Docker unavailable remains BLOCKED_EXTERNAL. Original pre-plan scope fidelity remains unrecoverable and superseded attempts are marked INCONCLUSIVE/production NO-GO.

- Original pre-plan scope capture remains unrecoverable; superseded attempts are INCONCLUSIVE. Docker unavailable keeps production_status=NO-GO and baseline status=BLOCKED_EXTERNAL.

- Original pre-plan scope evidence remains irrecoverable and prior attempts remain INCONCLUSIVE. Docker unavailable keeps repository baseline BLOCKED_EXTERNAL and production NO-GO.

- Original pre-plan scope evidence remains irrecoverable; prior attempts are INCONCLUSIVE. This independently prevents production GO and will require final scope-fidelity handling.

- Prior evidence root attempt-20260820T132730Z-fbccabc5 was superseded because its prechange captures were bound to the pre-repair commit; final evidence uses a fresh approved temp root.

- Current canonical attempt remains production NO-GO because registry provenance, SealedSecret ciphertext, real origins/certificates, Argo revision, live cluster UID, and external runtime evidence are unavailable. Repository-owned Todo 2 checks are independently verifiable.
- Repair verification remains external-NO-GO for registry attestations, SealedSecret ciphertext, real origins/certificates, Argo revision, live cluster UID, and runtime proof; no production GO or new evidence attempt was created.

- Docker, registry attestations, secrets/certs, real domains, Argo, cluster identity, and provider runtime proof remain unavailable; no production GO was fabricated after the consumer repair.

- The final Todo 2 scope deletion defect was repository-owned and is resolved. External release prerequisites remain unavailable and are recorded as `BLOCKED_EXTERNAL`; no production GO is claimed.

- Todo 3 cannot produce authenticated broker-loss evidence until Docker or an isolated Kafka cluster plus real certificates/SealedSecret material are supplied; production remains `NO-GO` by contract.

- Todo 4 cannot produce authenticated Elasticsearch node-loss evidence until Docker or an isolated Elasticsearch cluster plus real certificates/SealedSecret material are supplied; production remains `NO-GO` by contract.
- Todo 3 remediation external blocker (2026-08-21): no authenticated isolated Kafka cluster, Docker daemon, registry provenance, sealed Kafka material, or live cluster identity is available; broker-loss proof therefore remains `BLOCKED_EXTERNAL` and production remains `NO-GO`. Existing unrelated dirty worktree paths, including the video-transcoder test, were preserved and unstaged.
- Todo 3 repository-owned follow-up (2026-08-21): direct helper and semantic ACL tests were absent; external runtime remains unavailable, so this repair can prove configuration contracts only and must not promote broker-loss evidence to PASS.
- Todo 3 regression follow-up (2026-08-21): parser over-expansion, missing admin identity, runtime-specific TLS declaration drift, workload binding gaps, and local Compose placeholder resolution are repository-owned defects; authenticated broker-loss remains externally blocked.

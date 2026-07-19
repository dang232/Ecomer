# Incident Runbook

Production authority is protected Git plus Argo CD. Do not repair production by
editing a Deployment, rerunning Compose, or using Dokploy; Argo will overwrite
drift and the action will not have release evidence.

## First Ten Minutes

1. Name the incident commander, severity, start time, affected artifact IDs,
   and customer impact. Preserve `X-Correlation-Id` values.
2. Inspect `vnshop-prod` readiness, restart counts, events, Prometheus alerts,
   Argo sync/health/revision, and the current `infra/release/locks/prod.json`.
3. Check the dependency class in `infra/deployables.json`: authoritative `A`,
   rebuildable `R`, ephemeral `E`, or transport `T`.
4. Stop promotion and migration workflows when data correctness, credentials,
   checkout, payments, or identity are involved.
5. Prefer traffic reduction, a feature/provider disable, or a Git rollback over
   mutable live-cluster repair.

## Application Failure

Use the catalog probe path and compare the Deployment image and pod `imageID`
to the production lock with `infra/scripts/verify-live-release.py`. A restart is
reasonable only for a transient process failure on the current locked image.
For a release regression, dispatch `VNShop Prepare Production Rollback` with a
known-good production revision, obtain the required Code Owner approval, merge,
and let `VNShop Verify Production` prove the result. The post-merge target is 15 minutes.

## Authoritative Data

Do not restore into `vnshop-prod` during diagnosis. Confirm backup age first,
then dispatch `VNShop Backup and Restore Drill`; it restores to a network-isolated,
disposable namespace and destroys that namespace afterward. The drill must prove
the 24 hour RPO and 4 hour RTO before a production restore is authorized.

PostgreSQL contains service schemas and Keycloak. MongoDB and MinIO are also
authoritative. TimescaleDB is rebuildable but included in the drill. Redis and
Elasticsearch are rebuilt. Kafka is recreated and transactional outboxes are
replayed; never reset consumer offsets or delete topics before owners have
captured lag, outbox counts, and idempotency evidence.

## Messaging Recovery

Restore Kafka authentication first, then rerun the `vnshop-kafka-bootstrap`
Sync hook to create topics and least-privilege ACLs. Resume producers before
consumers only when outbox rows are durable. Track each outbox to terminal
publication, then validate order, payment, inventory, shipping, invoice,
notification, messaging, and search projections. Duplicate delivery is expected;
failed idempotency checks are an incident blocker.

## Credential Exposure

Revoke and rotate before cleanup. Preserve only redacted evidence, review access
logs, rewrite every Git ref, request provider cache purges, mark old history
obsolete, require controlled collaborators to re-clone, and run full-history
gitleaks. Branch rules, GitHub cache purges, credential rotation, and repository
history rewrite require `@dang232`; local deletion alone does not close the incident.

## Alert And Closeout

Use `VNShop Alert Delivery Drill` to prove a critical alert reaches the configured
receiver and returns a receipt ID within ten minutes. Close only after Argo is
Synced/Healthy at the intended revision, all 19 live image IDs match the lock,
readiness and SLO signals have recovered, outboxes and lag are draining, data
invariants pass, and the timeline plus follow-up owners are recorded.

# Release And Recovery Evidence

## Environments

Local development uses the working tree and Docker Compose. Staging follows
protected `main` into `vnshop-staging`; production follows protected `production`
into `vnshop-prod`. Both Argo applications prune and self-heal. A production
change exists only after an approved promotion or rollback merge.

## Release Chain

`source commit -> 19 builds -> 19 digests -> SBOM/provenance -> staging lock ->
main merge -> staging Argo revision/live image IDs/browser+k6 evidence -> unchanged
production lock -> production merge -> production Argo revision/live image IDs`

The release-candidate workflow builds once. Promotion copies the lock byte for
byte. `validate-k8s-release.py` rejects missing locks, placeholder digests,
mutable images, incomplete secrets, retired workloads, non-deterministic renders,
or a mismatch between the catalog, lock, and manifests.

## Recovery Chain

The daily CronJob uploads PostgreSQL/Keycloak, TimescaleDB, MongoDB, and MinIO to
encrypted off-cluster S3, retaining 14 daily and 8 weekly copies. The weekly
restore drill also encrypts and exports both desired-state branches, release
evidence, and the Sealed Secrets recovery key. It restores the newest data into
a disposable isolated namespace and records backup age and restore duration.

Redis and Elasticsearch are discarded and rebuilt. Kafka is recreated with the
bootstrap Sync hook, then service transactional outboxes are replayed. A restore
into production requires a successful isolated drill and incident-command approval.

## External Setup

Owner credentials are required to create the `production` branch, install branch
rules, install Sealed Secrets/cert-manager/ingress/Argo, populate encrypted secret
data, configure the cluster kubeconfig and CI CA secrets, configure S3 recovery
secrets, and connect an alert receiver exposing correlation receipt lookup.
Until those external gates are complete, strict release validation is expected
to fail and no availability or recovery claim is active.

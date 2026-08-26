# High-Availability Data Layer Decision

**Scope:** checkbox 17, production Kubernetes platform data services

## Decision

Use self-hosted HA primitives in the Kubernetes base:

- PostgreSQL uses the Zalando `postgres-operator`/Patroni `postgresql` resource with three instances, synchronous replication, and separate primary/replica services.
- Redis is split into three independent three-node Sentinel groups: `redis-rate-limit`, `redis-cart`, and `redis-dedup`.
- Redis eviction is workload-specific, never per-database: rate limiting uses `noeviction`, carts use `volatile-lru`, and deduplication uses `volatile-ttl`. Cart and dedup writes therefore require TTLs.
- MongoDB uses a three-member `rs0` replica set.
- MinIO uses four pods with two erasure-coded drives per pod, giving the requested 4+2 layout and preserving the `minio:9000` service contract.
- Keycloak runs two replicas against the HA PostgreSQL service and enables the Kubernetes Infinispan cache stack.

The manifest is intentionally production-oriented. It does not add a single-instance fallback or hide HA behind an opt-in profile.

## Managed Alternative

The managed alternative is:

- Amazon Aurora PostgreSQL or Cloud SQL/AlloyDB for PostgreSQL
- Amazon ElastiCache/MemoryDB or Azure Cache for Redis with workload-specific replication groups
- MongoDB Atlas replica set
- Amazon S3/Cloudflare R2 instead of MinIO
- Managed Keycloak hosting or a vendor-supported Keycloak operator

Managed services would reduce operator upgrade, backup, failover, and disk-repair burden. They are not selected for this repository because the deployment target must remain cloud-neutral, MinIO-compatible, and runnable on a Kubernetes cluster without binding the application contract to a single cloud provider. The managed option remains the preferred operational path when a production platform team has an approved provider budget and regional SLA requirement.

## Operational Requirements

The cluster must install and maintain the Zalando Postgres Operator before applying this base. Redis Sentinel, MongoDB replica-set initialization, MinIO bucket bootstrap, backups, and restore drills are release gates, not implied by pod count alone. Storage classes must provide independent failure domains; three replicas on one node or one disk do not constitute HA.

Workloads must consume the explicit Sentinel contracts from `redis-ha-contract` rather than the compatibility `redis` alias. The compatibility alias exists only to keep older probes and migration tooling resolvable while clients are moved to workload-specific endpoints.

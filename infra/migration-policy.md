# Migration Policy

## Reader and Goal

This policy is for engineers who create or review database changes for VNShop services. After reading it, they should be able to add a Flyway migration that can be validated in CI, deployed safely through staging, and recovered through a prepared incident procedure without rewriting Flyway history.

## Scope

VNShop uses PostgreSQL on port `5432` with one logical database, `vnshop`, and service-owned schemas such as `user_svc`, `product_svc`, `inventory_svc`, `coupon_svc`, `review_svc`, `seller_finance_svc`, `order_svc`, `payment_svc`, `shipping_svc`, `search_svc`, and `notification_svc`.

Most Java services run Flyway from their service startup. Each service owns migrations for its own schema. Cross-schema changes need an explicit design review before any migration is written.

## Strict Rules

1. Every schema change must be a versioned Flyway migration named with the next unused `V` number for that service.
2. Never edit a merged or deployed migration. Add a new migration instead.
3. `V` migrations must be backward compatible with the currently deployed application version.
4. Destructive migrations are not allowed in normal `V` files.
5. Flyway scans forward-only additive migrations from `db/migration`. Prepared incident scripts live in `db/rollback` and are not in a Flyway scan path.
6. A pre-migration backup is required before staging and production execution.
7. CI must run `mvn flyway:validate` for the affected service before merge.
8. Staging must run the exact migration artifact before production.
9. Production deploys must keep the old app version able to run against the new schema until the rollout is complete.

## Allowed Backward-Compatible Changes

Use additive changes first. Safe examples:

1. Create a new table in the owning service schema.
2. Add a nullable column.
3. Add a column with a safe default that does not rewrite large tables during peak traffic.
4. Add an index concurrently when table size needs it.
5. Add a new enum-like lookup row when old code ignores it.
6. Add a new constraint as `NOT VALID`, backfill data, then validate in a later migration.

For multi-step changes, split work across releases. First add the new shape. Then deploy code that writes both shapes or reads both shapes. Backfill. Switch reads. Only after old code is gone may cleanup be proposed, and cleanup still needs explicit approval.

## Forbidden Changes In Normal Migrations

Do not put these in normal `V` migrations:

1. `DROP TABLE`, `DROP COLUMN`, or `DROP SCHEMA`.
2. `TRUNCATE`.
3. Broad `DELETE` statements without a reviewed, bounded predicate.
4. Column type changes that can break old code or block writes.
5. Renames that make old code fail.
6. Adding `NOT NULL` to existing columns before data is backfilled and old writers are checked.
7. Rewriting primary keys or foreign keys in one step.
8. Any migration that depends on another service deploying at the same moment.

If destructive cleanup is needed, write a separate proposal. It must prove no running code reads or writes the old object, include backup restore steps, and get explicit approval.

## Forward Migration Checklist

Before opening a migration PR:

1. Confirm the owning service and schema.
2. Pick the next sequential `V` number for that service.
3. Write idempotent DDL where PostgreSQL supports it, such as `CREATE TABLE IF NOT EXISTS`.
4. Keep migration runtime short. Avoid long locks during customer traffic.
5. Add indexes with attention to table size and write volume.
6. Keep data backfills bounded. Large backfills need batching and a runbook.
7. Prepare a reviewed incident script in `db/rollback` when the migration needs an operational recovery procedure. Do not give the script a Flyway `V` version or place it in `db/migration`.
8. Run `mvn flyway:validate` for the affected service.
9. Test startup against a clean database and an already-migrated database.

## Rollback Policy

Rollback restores safe application behavior; it does not edit Flyway history or run a reverse migration through the normal Flyway scan.

Forward migrations remain additive and forward-only in `db/migration`. Prepared, non-scanned incident scripts live in `db/rollback` beside the affected service. An incident script documents its paired forward migration, prerequisites, approval, verification, and the exact manual execution path. It is not named as a Flyway `V` migration and does not become part of normal startup.

Ordinary rollback switches application feature modes or routes traffic to a compatible release while additive tables, columns, and journal history remain intact. A destructive incident action requires incident-command approval, proof that no running code needs the object, a verified backup/restore path, and an audit record. If cleanup remains necessary, introduce it later as an explicitly approved forward migration.

Do not run ad hoc SQL in production unless incident command approves it and records the exact command. If emergency SQL is used, capture it as a later Flyway migration so environments do not drift.

## Backup Requirement

Before staging or production migration:

1. Take a PostgreSQL backup for database `vnshop` on port `5432`.
2. Record backup name, time, environment, migration versions, and operator.
3. Confirm restore path is known before running migration.
4. Keep the backup until the migration has survived the agreed monitoring window.

For local Docker Compose, `vnshop-postgres` stores data in `postgres-data`. Do not treat volume snapshots as enough for staging or production. Use database-level backups.

## Deployment Flow

1. Run `mvn flyway:validate` for each affected service in CI.
2. Deploy to staging first.
3. Confirm service health endpoints on their ports after migration:
   1. API Gateway, `8080`.
   2. User Service, `8081`.
   3. Product Service, `8082`.
   4. Inventory Service, `8083`.
   5. Cart Service, `8084`.
   6. Search Service, `8086`.
   7. Notification Service, `8087`.
   8. Coupon Service, `8088`.
   9. Review Service, `8089`.
   10. Seller Finance Service, `8090`.
   11. Order Service, `8091`.
   12. Payment Service, `8092`.
   13. Shipping Service, `8093`.
4. Check Postgres health on `5432`, Redis on `6379`, Kafka on `9092`, Keycloak on `8085`, and Elasticsearch on `9200` when the affected service depends on them.
5. Run the same artifact in production only after staging passes.
6. Watch logs, error rate, latency, connection pool usage, and Flyway history after production deploy.

## Review Checklist

A migration PR is not ready unless it answers these questions:

1. Which service owns this schema change?
2. Is the change backward compatible with the currently deployed app?
3. Does `db/rollback` contain a reviewed, non-scanned incident script when recovery needs one?
4. What backup will be taken before execution?
5. Did `mvn flyway:validate` pass for the affected service?
6. Did staging run before production?
7. What metrics or logs prove the app is healthy after migration?

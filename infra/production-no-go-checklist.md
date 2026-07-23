# Production Go/No-Go Checklist

This checklist governs the portfolio target: protected Git branches, Argo CD,
one cluster with isolated `vnshop-staging` and `vnshop-prod` namespaces, 99.0%
availability, 24 hour RPO, 4 hour RTO, and a 15 minute post-merge rollback.
Compose and Dokploy are local or archived paths and provide no release evidence.

## Artifact Identity

- [ ] `infra/deployables.json` validates with exactly 19 artifacts.
- [ ] Frontend, gateway, cart, configuration, inventory, invoice, messaging,
  monitoring, notification, order, payment, product, recommendations, search,
  seller-finance, shipping, user, video-moderator, and video-transcoder are present.
- [ ] Coupon and review workloads are absent; order-service owns coupons and
  product-service owns reviews.
- [ ] The release lock contains 19 non-placeholder digests and an SBOM and
  provenance URI for every image.
- [ ] Staging and production use the exact same lock; no promotion rebuild ran.

## Governance And Security

- [ ] `main` and `production` require pull requests, CI, CodeQL, Deployable,
  resolved conversations, linear history, and prohibit force-push/delete.
- [ ] `production` requires `@dang232` Code Owner approval; bots cannot bypass.
- [ ] The incident owner signed the redacted credential-rotation/history scan
  record and collaborators re-cloned the rewritten repository.
- [ ] Gitleaks full-history and changed-image Trivy reports are clean, or each
  exception is scoped and expires within 30 days.
- [ ] The strict Kustomize validator passes with populated SealedSecret data.

## Staging Release

- [ ] Argo reports exact desired-state revision `Synced` and `Healthy` within 15 minutes.
- [ ] `verify-live-release.py` proves every desired and running image ID matches
  the 19-digest lock and at least one pod per artifact is Ready.
- [ ] HTTPS certificates validate against `vnshop-ci-root` with exact web, API,
  and auth SANs; Playwright does not ignore certificate errors.
- [ ] Runtime config, OIDC issuer, PKCE S256, redirects, secure cookies, API
  bearer authentication, and both WebSocket upgrades pass.
- [ ] k6 reports under 1% failures, p95 under 500 ms, and p99 under 2 seconds.

## Data And Operations

- [ ] PostgreSQL/Keycloak, TimescaleDB, MongoDB, MinIO, Git desired state,
  release evidence, and the Sealed Secrets key are in encrypted off-cluster S3.
- [ ] The newest backup is at most 24 hours old with 14 daily and 8 weekly copies.
- [ ] The latest isolated restore drill completed within 4 hours and its report
  contains restored PostgreSQL, TimescaleDB, MongoDB, and MinIO evidence.
- [ ] Redis and Elasticsearch rebuild procedures and Kafka/outbox replay were tested.
- [ ] A critical synthetic alert produced a receipt ID within 10 minutes.
- [ ] Prometheus has one readiness target per artifact and the 99.0% SLO and
  backup-age alerts are loaded.

## Marketplace Settlement Release Gates

- [ ] **COD collection truth:** verified carrier collection evidence proves that COD seller settlement cannot complete from order creation, delivery, or buyer confirmation alone.
- [ ] **Ledger balance:** the append-only journal trial balance is proven for each affected currency, including compensating refund, chargeback, and reserve postings.
- [ ] **Backfill evidence:** reconciliation records prove source counts, amounts, currencies, idempotency keys, rejects, and rerun behavior for every finance backfill.
- [ ] **Payout idempotency:** duplicate request and provider-delivery tests prove one payout outcome per stable idempotency key; invalid or unknown schemas leave ledger and idempotency state unchanged.
- [ ] **Provider/manual evidence:** verified provider capture, refund, and chargeback evidence, plus the approved manual-operational evidence path, are retained for the release.
- [ ] **Projection drift:** source facts, ledger balances, payout projections, and operator read models reconcile within the approved tolerance.
- [ ] **DLT health:** dead-letter topic depth, age, replay procedure, and alerting are healthy; unreconciled finance messages block release.
- [ ] **Destination masking:** production API, logs, exports, support views, and release evidence prove bank destinations are masked; missing or invalid payout, encryption, provider, or masking configuration fails closed.

## Production And Rollback

- [ ] The protected production PR contains only the unchanged lock, generated
  desired state, and staging reconciliation evidence.
- [ ] Argo reports the exact production revision `Synced` and `Healthy` within 20 minutes.
- [ ] Production live image IDs match the lock for all 19 artifacts.
- [ ] The rollback workflow restored a prior known-good lock through a protected
  PR; post-merge Argo reconciliation and image verification took no more than 15 minutes.
- [ ] Release owner and incident commander recorded a manual go decision.

Any unchecked item is a no-go unless the release owner records a time-bounded,
explicit risk acceptance. Checkout, payment, identity, data recovery, or
credential exposure blockers cannot be waived.

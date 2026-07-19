# Public Credential Incident Response

## Scope

The repository previously tracked a Dokploy environment file, an SSH private
key, deployment documentation containing credential values, and Kafka SSL
credential material. Treat every value in those files as compromised even when
the corresponding infrastructure is believed to be offline.

This repository change removes the files from the current tree. Removal from a
new commit does not remove values from existing Git objects, forks, clones,
caches, workflow artifacts, or provider logs.

## Owner Gate

The accountable owner is `@dang232`. Complete every item below before enabling
Argo CD, creating public DNS, or accepting external traffic.

1. Preserve a redacted incident timeline and the original commit identifiers in
   encrypted, access-controlled evidence storage. Never attach raw values.
2. Revoke the exposed SSH key at every host and deployment provider. Remove its
   public-key authorization and terminate sessions that used the identity.
3. Rotate every credential named in the removed files, including database,
   Kafka, Keycloak, MinIO, MongoDB, Redis, Elasticsearch, monitoring, and
   notification credentials. Rotate dependent client configuration afterwards.
4. Review authentication, deployment, network, and provider audit logs from the
   first exposed commit through 24 hours after revocation. Record only redacted
   event identifiers, timestamps, actors, source networks, and conclusions.
5. Remove leaked values from workflow artifacts, caches, releases, issue text,
   pull-request text, and external deployment-provider logs where supported.
6. Rewrite every public Git ref with `git filter-repo` using an approved path and
   replacement manifest. Coordinate a maintenance window before force-pushing.
7. Ask GitHub and other providers to purge unreachable cached objects after the
   rewritten refs are visible.
8. Invalidate old clones and require controlled collaborators to re-clone. Do
   not merge branches created from obsolete history.
9. Run full-history secret scanning against every rewritten ref and archive the
   redacted JSON report with the incident record.
10. Verify revoked credentials fail and replacement credentials work only from
    their intended principals and networks.

## Rewrite Manifest

At minimum, the rewrite must remove all historical versions of:

- `.env.dokploy`
- `ssh_private_key_for_dokploy.pem`
- `infra/kafka/certs/ssl_credentials`

It must also replace credential values embedded in historical versions of
`DOKPLOY-DEPLOYMENT.md`. Build the replacement expressions from the encrypted
incident evidence; do not store them in Git.

History rewriting is intentionally not automated from CI. It is destructive,
invalidates commit identities, and requires coordinated force-push access plus
provider-side cache purges.

## Required Evidence

The redacted incident record must include:

- incident owner, declaration time, containment time, and closure time;
- affected credential classes and providers;
- revoked-login test identifiers and result timestamps;
- audit-log review range and conclusion;
- pre-rewrite and post-rewrite tip commits;
- full-history scanner version, configuration hash, report checksum, and result;
- provider purge request identifiers;
- collaborator re-clone acknowledgements;
- remaining risks and approved exceptions.

Do not mark the incident gate complete while any credential remains valid, any
public ref contains the material, or full-history scanning reports a finding.

# Release Locks

`staging.json` and `prod.json` are generated release evidence, not hand-edited
configuration. A lock has this shape:

```json
{
  "schemaVersion": "1.0",
  "sourceCommit": "40-character Git SHA",
  "createdAt": "RFC3339 timestamp",
  "artifacts": [
    {
      "id": "frontend",
      "image": "ghcr.io/dang232/vnshop-frontend",
      "digest": "sha256:...",
      "sbom": "artifact://sbom/frontend.spdx.json",
      "provenance": "https://github.com/dang232/Ecomer/attestations/...",
      "provenanceVerified": true
    }
  ]
}
```

The set must exactly match `infra/deployables.json`. Digests cannot be all-zero
placeholders. Production promotion copies the staging lock byte-for-byte and
never rebuilds an image.

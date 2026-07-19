# Dokploy Deployment Retired

Dokploy is not an authorized staging or production deployment path for VNShop.
The previous document and its associated environment and SSH credential files
were removed after public exposure was identified.

Production-shaped deployments use the Kustomize overlays under `infra/k8s/`
and Argo CD applications under `infra/gitops/`. Local development continues to
use Docker Compose and must load secrets from ignored local files.

Do not restore credentials, host addresses, private keys, or operator commands
to this document. Follow `infra/security/credential-incident-response.md` for
credential rotation and history-rewrite requirements.

# VNShop GitOps Contract

Argo CD owns staging from protected `main` and production from protected
`production`. The production branch changes only through an approved promotion
pull request. Both applications prune and self-heal after their branch moves.

Install the Sealed Secrets controller and ingress/cert-manager prerequisites,
then apply `argocd/project.yaml` from an administrator context. Application
manifests do not grant Argo cluster-admin access.

Sync waves are fixed:

- `-20`: namespace, service accounts, config, and network policy
- `-15`: SealedSecret and stateful platform services
- `-10`: database principal/schema `Sync` hook
- `0`: the 19 application Deployments and Services
- `5`: backup policy and CronJob
- `10`: TLS ingress

The migration hook uses `BeforeHookCreation,HookSucceeded`. A release with an
unresolved digest or empty `encryptedData` is rejected by the release validator
before either protected branch can advance.

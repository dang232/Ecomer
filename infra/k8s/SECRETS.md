# Sealed Secret Contract

`vnshop-runtime-secrets` is the only application secret rendered by Kustomize.
Its `encryptedData` must be populated with `kubeseal` before a release lock can
pass the strict validator. The checked manifest intentionally contains no
plaintext, base64 placeholder, or production default.

Required key groups:

- Platform administrators: PostgreSQL, TimescaleDB, MongoDB, Redis, Kafka,
  MinIO, Keycloak, and the Kafka cluster/JAAS values.
- Per-service principals: a database username/password or complete Node/Python
  database URL, Kafka username/password for each Kafka consumer/producer, and
  scoped MinIO access/secret keys for product, user, and both video workers.
- Recovery: off-cluster S3 bucket, prefix, region, access key, and secret key.
- Operations: `alert-webhook-url` for the durable paging/receipt endpoint.
- Optional payment providers: `payment-vietqr-account-no`,
  `payment-vietqr-account-name`, `payment-vnpay-tmn-code`,
  `payment-vnpay-hash-secret`, `payment-momo-partner-code`,
  `payment-momo-access-key`, `payment-momo-secret-key`,
  `payment-stripe-secret-key`, `payment-stripe-publishable-key`,
  `payment-stripe-webhook-secret`, `payment-paypal-client-id`, and
  `payment-paypal-client-secret`. These become required only when their
  corresponding `*_ENABLED` configuration flag is true.

The validator derives the exact required key set from every `secretKeyRef` and
secret volume item in the rendered manifests. Extra provider keys may be sealed
for optional Stripe or PayPal sandbox activation, but payment credentials must
never be supplied through ConfigMaps or environment defaults.

List the exact keys before preparing the out-of-repository environment file:

```bash
kubectl kustomize infra/k8s/overlays/staging > /tmp/vnshop-rendered.yaml
python - <<'PY'
import yaml

documents = list(yaml.safe_load_all(open('/tmp/vnshop-rendered.yaml', encoding='utf-8')))
keys = set()

def collect(value):
    if isinstance(value, dict):
        ref = value.get('secretKeyRef')
        if isinstance(ref, dict) and ref.get('name') == 'vnshop-runtime-secrets':
            keys.add(ref['key'])
        secret = value.get('secret')
        if isinstance(secret, dict) and secret.get('secretName') == 'vnshop-runtime-secrets':
            keys.update(item['key'] for item in secret.get('items', []))
        for nested in value.values():
            collect(nested)
    elif isinstance(value, list):
        for nested in value:
            collect(nested)

collect(documents)
print('\n'.join(sorted(keys)))
PY
```

Create the plaintext Secret outside Git, seal it with the cluster certificate,
replace `spec.encryptedData`, delete the plaintext source, and run:

```bash
python infra/scripts/validate-k8s-release.py --environment staging
python infra/scripts/validate-k8s-release.py --environment prod
```

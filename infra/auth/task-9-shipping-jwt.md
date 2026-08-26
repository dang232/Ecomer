# Task 9 Evidence: Carrier Webhooks and JWT Gateway Bypass

Date: 2026-08-25

## Implemented contract

- GHN and GHTK use independent inbound webhook secrets, separate from outbound carrier API tokens.
- Missing or invalid signatures are rejected in every carrier mode, including stub mode.
- GHTK canonical signing is `vnshop-ghtk-webhook-v1|` followed by the ordered fields `label_id`, `status`, `status_text`, `updated_at`, `order_id`, `cod_collected_amount`, `collection_id`, `currency`; every field name and value is UTF-8 byte-length-prefixed as `<byte-length>:<value>` and terminated by `;`; null is the empty string; timestamps use `Instant.toString()`; decimals use `stripTrailingZeros().toPlainString()`; HMAC-SHA256 output is standard Base64.
- GHTK timestamps outside the configured five-minute absolute replay window are rejected.
- Java and Node resource servers require the configured issuer and `vnshop-api` audience while retaining separate JWKS URLs for key rotation.
- Notification and monitoring Socket.IO verification now checks issuer, audience, RS256, JWKS, and non-empty subject.
- Configuration-service startup clients fail closed when enabled without an internal token; no blank-token fallback is emitted.

## Focused static/unit evidence

```bash
set -euo pipefail
./mvnw.cmd -q '-Dtest=WebhookSecurityMockMvcTest,WebhookSignatureServiceTest,WebhookControllerTest' test 2>&1 | tee shipping-jwt-2026-08-25.log
```

Observed: 19 shipping webhook/security tests passed, including real security-filter-chain webhook acceptance, missing-signature rejection, HMAC mutation rejection, replay rejection, missing-secret rejection, durable duplicate handling, and 503 storage failure handling.

Node JWT commands were attempted but could not execute because this checkout has no installed `node_modules`; `jest` and `nest` were unavailable. TypeScript LSP was also unavailable.

## Manual/live evidence

Docker is unavailable in this environment, so no live gateway/service curl or carrier callback proof is claimed. When services are running, send one correctly signed callback, one missing-signature callback, one mutated-field callback, and one stale-timestamp callback through the gateway and record HTTP 200/401 outcomes.

## Risks and follow-up

- Public GHN/GHTK documentation does not establish the exact HMAC/canonical format; obtain a carrier-supplied test vector before production enablement and update the canonical contract if it differs.
- Existing deployments must migrate from `*_WEBHOOK_TOKEN` to `*_WEBHOOK_SECRET`; no compatibility fallback is intentionally retained because secrets must remain independent.
- Full-stack live JWT/JWKS rotation and curl proof remain environment-gated.

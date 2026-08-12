DELETE FROM payment_svc.pending_webhooks duplicate
USING payment_svc.pending_webhooks keeper
WHERE duplicate.webhook_id = keeper.webhook_id
  AND duplicate.provider = keeper.provider
  AND (duplicate.created_at > keeper.created_at
       OR (duplicate.created_at = keeper.created_at AND duplicate.id > keeper.id));

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_webhooks_webhook_provider
    ON payment_svc.pending_webhooks (webhook_id, provider);

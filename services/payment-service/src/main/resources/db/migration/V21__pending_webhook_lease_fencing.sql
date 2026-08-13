ALTER TABLE payment_svc.pending_webhooks
    ADD COLUMN IF NOT EXISTS lease_token UUID;

CREATE INDEX IF NOT EXISTS idx_pending_webhooks_processing_lease
    ON payment_svc.pending_webhooks (status, next_retry_at)
    WHERE status = 'PROCESSING';

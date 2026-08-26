CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_callback_identity
    ON payment_svc.payment_callback_logs (provider, event_id, payload_hash, signature_hash);

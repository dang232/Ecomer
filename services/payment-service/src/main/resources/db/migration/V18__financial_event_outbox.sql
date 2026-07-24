-- Partial refund and chargeback events use this durable, provider-owned outbox.
CREATE TABLE IF NOT EXISTS payment_svc.financial_event_outbox (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    event_type VARCHAR(96) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    dead BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_financial_event_outbox_retry
    ON payment_svc.financial_event_outbox (published_at, dead, next_attempt_at, created_at);

ALTER TABLE payment_svc.chargebacks
    ADD COLUMN IF NOT EXISTS challenged_amount NUMERIC(19, 2),
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(255);

ALTER TABLE payment_svc.payments
    DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payment_svc.payments
    ADD CONSTRAINT payments_status_check
        CHECK (status IN ('PENDING', 'AWAITING_COLLECTION', 'COMPLETED', 'PARTIALLY_REFUNDED', 'FAILED', 'REFUNDED', 'PAYMENT_TIMEOUT'));

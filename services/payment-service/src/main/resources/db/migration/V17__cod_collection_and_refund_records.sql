-- COD collection evidence is a payment-side immutable reference to the
-- shipping-owned collection event. The shipping service remains the source
-- of truth for carrier evidence and expected COD labels.
ALTER TABLE payment_svc.payments
    DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payment_svc.payments
    ADD CONSTRAINT payments_status_check
        CHECK (status IN ('PENDING', 'AWAITING_COLLECTION', 'COMPLETED', 'FAILED', 'REFUNDED', 'PAYMENT_TIMEOUT'));

ALTER TABLE payment_svc.payments
    ADD COLUMN IF NOT EXISTS cod_collection_event_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS cod_collected_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_cod_collection_event_id
    ON payment_svc.payments (cod_collection_event_id)
    WHERE cod_collection_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_svc.payment_refund_records (
    refund_id UUID NOT NULL PRIMARY KEY,
    payment_id UUID NOT NULL REFERENCES payment_svc.payments (payment_id),
    provider_ref VARCHAR(1024) NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_refund_records_payment_id
    ON payment_svc.payment_refund_records (payment_id);

ALTER TABLE payment_svc.payment_idempotency_keys
    DROP CONSTRAINT IF EXISTS payment_idempotency_keys_payment_id_fkey;

ALTER TABLE payment_svc.payment_idempotency_keys
    ALTER COLUMN payment_id DROP NOT NULL;

ALTER TABLE payment_svc.payment_idempotency_keys
    ADD COLUMN IF NOT EXISTS claim_status VARCHAR(32) NOT NULL DEFAULT 'CLAIMED',
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS lease_until TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_payment_idempotency_claims_lease
    ON payment_svc.payment_idempotency_keys (claim_status, lease_until);

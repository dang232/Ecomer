-- Safe payout execution state, idempotency, and immutable destination snapshot.
-- Legacy rows remain readable through PENDING/COMPLETED/FAILED compatibility values.
ALTER TABLE seller_finance_svc.payouts
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS destination_snapshot_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS destination_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS destination_ciphertext TEXT,
    ADD COLUMN IF NOT EXISTS destination_key_version INTEGER,
    ADD COLUMN IF NOT EXISTS destination_algorithm VARCHAR(64),
    ADD COLUMN IF NOT EXISTS destination_fingerprint VARCHAR(255),
    ADD COLUMN IF NOT EXISTS destination_bank_account_last4 VARCHAR(4),
    ADD COLUMN IF NOT EXISTS destination_bank_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS destination_captured_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS destination_integrity_envelope TEXT,
    ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS paid_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS external_reference VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_attempt_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS evidence_reference VARCHAR(255),
    ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(1000);

UPDATE seller_finance_svc.payouts
SET currency = 'VND'
WHERE currency IS NULL OR currency = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_payouts_seller_idempotency
    ON seller_finance_svc.payouts (seller_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payouts_provider_attempt
    ON seller_finance_svc.payouts (provider_attempt_id)
    WHERE provider_attempt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payouts_paid_at
    ON seller_finance_svc.payouts (paid_at)
    WHERE paid_at IS NOT NULL;

-- =====================================================================
-- V10: Secure payout destination enrollment
-- ---------------------------------------------------------------------
-- Adds encrypted destination columns while preserving the legacy
-- bank_account column. SQL migrations do not have access to the
-- application key ring, so they cannot produce verifiable ciphertext.
-- Existing plaintext remains the source of truth until a key-aware
-- application backfill has encrypted and round-trip-verified every row.
-- A later, separately reviewed migration may remove it after that holds.
-- =====================================================================

ALTER TABLE user_svc.seller_profiles
    ADD COLUMN IF NOT EXISTS destination_id            VARCHAR(36),
    ADD COLUMN IF NOT EXISTS destination_fingerprint   VARCHAR(128),
    ADD COLUMN IF NOT EXISTS destination_ciphertext    TEXT,
    ADD COLUMN IF NOT EXISTS destination_key_version   INTEGER,
    ADD COLUMN IF NOT EXISTS destination_algorithm     VARCHAR(32),
    ADD COLUMN IF NOT EXISTS bank_account_last4        VARCHAR(4),
    ADD COLUMN IF NOT EXISTS verification_state        VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS destination_enrolled_at   TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS destination_updated_at    TIMESTAMP WITH TIME ZONE;

-- New secure-only sellers must be insertable while old rows retain their
-- legacy value for the controlled, key-aware backfill. This changes only
-- the constraint; it does not rewrite or remove existing data.
ALTER TABLE user_svc.seller_profiles
    ALTER COLUMN bank_account DROP NOT NULL;

-- Index for the internal lookup (seller-service -> user-service) so
-- destination resolution is a single index probe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_profiles_destination_id
    ON user_svc.seller_profiles (destination_id)
    WHERE destination_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seller_profiles_destination_fingerprint
    ON user_svc.seller_profiles (destination_fingerprint);

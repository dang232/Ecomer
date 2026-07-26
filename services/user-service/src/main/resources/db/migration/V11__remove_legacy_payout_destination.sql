-- =====================================================================
-- V11: Remove the legacy plaintext payout destination
-- ---------------------------------------------------------------------
-- V10 introduced encrypted destination columns but intentionally kept
-- bank_account so a key-aware application backfill could migrate existing
-- rows. This migration is the irreversible cleanup step. It fails closed
-- when any non-blank legacy value remains; it never silently discards data.
-- =====================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM user_svc.seller_profiles
        WHERE bank_account IS NOT NULL
          AND btrim(bank_account) <> ''
    ) THEN
        RAISE EXCEPTION
            'Cannot remove seller_profiles.bank_account: key-aware payout destination backfill is incomplete';
    END IF;
END
$$;

ALTER TABLE user_svc.seller_profiles
    DROP COLUMN IF EXISTS bank_account;

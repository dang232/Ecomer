-- Preserve historical duplicate phone values without guessing which buyer owns
-- them. New registrations and every phone change receive a unique claim.
ALTER TABLE user_svc.buyer_profiles
    ADD COLUMN IF NOT EXISTS phone_claim VARCHAR(255);

-- Backfill only unambiguous legacy values. Duplicate values intentionally keep
-- a null claim and remain visible for operations-led reconciliation.
UPDATE user_svc.buyer_profiles b
SET phone_claim = b.phone
WHERE b.phone IS NOT NULL
  AND b.phone_claim IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM user_svc.buyer_profiles competing
      WHERE competing.phone = b.phone
        AND competing.id <> b.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_profiles_phone_claim
    ON user_svc.buyer_profiles (phone_claim)
    WHERE phone_claim IS NOT NULL;

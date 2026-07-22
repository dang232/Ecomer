ALTER TABLE user_svc.buyer_profiles
    ADD COLUMN IF NOT EXISTS email VARCHAR(320);

CREATE INDEX IF NOT EXISTS idx_buyer_profiles_email
    ON user_svc.buyer_profiles (lower(email));

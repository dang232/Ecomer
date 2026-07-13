-- V8: add rejection_reason column for seller rejection flow.
ALTER TABLE user_svc.seller_profiles
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

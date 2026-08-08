-- flyway:executeInTransaction=false
-- These indexes are additive and must not block writes on large production tables.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buyer_profiles_admin_name_keycloak
    ON user_svc.buyer_profiles (lower(coalesce(name, '')), lower(keycloak_id));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buyer_profiles_admin_keycloak_prefix
    ON user_svc.buyer_profiles ((lower(coalesce(keycloak_id, ''))) text_pattern_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buyer_profiles_admin_email_prefix
    ON user_svc.buyer_profiles ((lower(coalesce(email, ''))) text_pattern_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buyer_profiles_admin_name_prefix
    ON user_svc.buyer_profiles ((lower(coalesce(name, ''))) text_pattern_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buyer_profiles_admin_phone_prefix
    ON user_svc.buyer_profiles ((lower(coalesce(phone, ''))) text_pattern_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seller_profiles_admin_pending_created_keycloak
    ON user_svc.seller_profiles (approved, created_at DESC, lower(keycloak_id) DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seller_profiles_admin_pending_keycloak_prefix
    ON user_svc.seller_profiles (approved, (lower(coalesce(keycloak_id, ''))) text_pattern_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seller_profiles_admin_pending_shop_prefix
    ON user_svc.seller_profiles (approved, (lower(coalesce(shop_name, ''))) text_pattern_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seller_profiles_admin_pending_bank_prefix
    ON user_svc.seller_profiles (approved, (lower(coalesce(bank_name, ''))) text_pattern_ops);

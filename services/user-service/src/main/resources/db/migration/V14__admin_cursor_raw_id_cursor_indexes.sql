-- Replace the V13 case-folded tie-breaker indexes with indexes matching the
-- unique raw Keycloak IDs used by the cursor predicates and ordering.
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_admin_name_keycloak_raw_v14
    ON user_svc.buyer_profiles (lower(coalesce(name, '')), keycloak_id);
DROP INDEX IF EXISTS user_svc.idx_buyer_profiles_admin_name_keycloak;
ALTER INDEX IF EXISTS user_svc.idx_buyer_profiles_admin_name_keycloak_raw_v14
    RENAME TO idx_buyer_profiles_admin_name_keycloak;

CREATE INDEX IF NOT EXISTS idx_seller_profiles_admin_pending_created_keycloak_raw_v14
    ON user_svc.seller_profiles (approved, created_at DESC, keycloak_id DESC);
DROP INDEX IF EXISTS user_svc.idx_seller_profiles_admin_pending_created_keycloak;
ALTER INDEX IF EXISTS user_svc.idx_seller_profiles_admin_pending_created_keycloak_raw_v14
    RENAME TO idx_seller_profiles_admin_pending_created_keycloak;

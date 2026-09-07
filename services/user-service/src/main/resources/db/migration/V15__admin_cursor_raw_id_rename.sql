-- Swap the V14 raw-Keycloak-ID indexes into their canonical names.
-- Split from V14 because Flyway rejects mixing non-transactional
-- CONCURRENTLY statements with transactional ALTER INDEX in one migration.
ALTER INDEX IF EXISTS user_svc.idx_buyer_profiles_admin_name_keycloak_raw_v14
    RENAME TO idx_buyer_profiles_admin_name_keycloak;
ALTER INDEX IF EXISTS user_svc.idx_seller_profiles_admin_pending_created_keycloak_raw_v14
    RENAME TO idx_seller_profiles_admin_pending_created_keycloak;

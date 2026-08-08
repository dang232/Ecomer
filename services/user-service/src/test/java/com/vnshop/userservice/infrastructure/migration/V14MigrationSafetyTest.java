package com.vnshop.userservice.infrastructure.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class V14MigrationSafetyTest {
    @Test
    void replacesCaseFoldedTieBreakersForwardOnlyAndConcurrently() throws IOException {
        String sql;
        try (InputStream input = V14MigrationSafetyTest.class.getResourceAsStream(
                "/db/migration/V14__admin_cursor_raw_id_cursor_indexes.sql")) {
            assertThat(input).isNotNull();
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertThat(sql).contains("flyway:executeInTransaction=false");
        assertThat(sql).contains("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buyer_profiles_admin_name_keycloak_raw_v14");
        assertThat(sql).contains("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seller_profiles_admin_pending_created_keycloak_raw_v14");
        assertThat(sql).contains("DROP INDEX CONCURRENTLY IF EXISTS user_svc.idx_buyer_profiles_admin_name_keycloak");
        assertThat(sql).contains("DROP INDEX CONCURRENTLY IF EXISTS user_svc.idx_seller_profiles_admin_pending_created_keycloak");
        assertThat(sql).contains("RENAME TO idx_buyer_profiles_admin_name_keycloak");
        assertThat(sql).contains("RENAME TO idx_seller_profiles_admin_pending_created_keycloak");
        assertThat(sql).doesNotContainIgnoringCase("DROP TABLE");
        assertThat(sql).doesNotContainIgnoringCase("DELETE FROM");
        assertThat(sql).doesNotContainIgnoringCase("ALTER TABLE");
    }
}

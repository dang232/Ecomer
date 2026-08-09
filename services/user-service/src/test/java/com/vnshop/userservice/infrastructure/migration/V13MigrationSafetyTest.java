package com.vnshop.userservice.infrastructure.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class V13MigrationSafetyTest {
    @Test
    void createsAdminCursorIndexesConcurrentlyWithoutDestructiveStatements() throws IOException {
        String sql;
        try (InputStream input = V13MigrationSafetyTest.class.getResourceAsStream(
                "/db/migration/V13__admin_cursor_indexes.sql")) {
            assertThat(input).isNotNull();
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertThat(sql).contains("flyway:executeInTransaction=false");
        assertThat(sql).contains("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buyer_profiles_admin_name_keycloak");
        assertThat(sql).contains("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seller_profiles_admin_pending_created_keycloak");
        assertThat(sql).contains("approved, created_at DESC, lower(keycloak_id) DESC");
        assertThat(sql).contains("idx_buyer_profiles_admin_email_prefix");
        assertThat(sql).contains("idx_seller_profiles_admin_pending_shop_prefix");
        assertThat(sql).doesNotContainIgnoringCase("DROP TABLE");
        assertThat(sql).doesNotContainIgnoringCase("DELETE FROM");
        assertThat(sql).doesNotContainIgnoringCase("ALTER TABLE");
    }
}

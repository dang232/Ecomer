package com.vnshop.userservice.infrastructure.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class V14MigrationSafetyTest {
    private static String migrationSql(String name) throws IOException {
        try (InputStream input = V14MigrationSafetyTest.class.getResourceAsStream(
                "/db/migration/" + name)) {
            assertThat(input).as("migration %s must exist", name).isNotNull();
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test
    void replacesCaseFoldedTieBreakersForwardOnlyAndConcurrently() throws IOException {
        // V14 must stay purely non-transactional: Flyway rejects mixing
        // CONCURRENTLY statements with transactional ones in a single migration.
        String sql = migrationSql("V14__admin_cursor_raw_id_cursor_indexes.sql");
        assertThat(sql).contains("flyway:executeInTransaction=false");
        assertThat(sql).contains("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buyer_profiles_admin_name_keycloak_raw_v14");
        assertThat(sql).contains("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seller_profiles_admin_pending_created_keycloak_raw_v14");
        assertThat(sql).contains("DROP INDEX CONCURRENTLY IF EXISTS user_svc.idx_buyer_profiles_admin_name_keycloak");
        assertThat(sql).contains("DROP INDEX CONCURRENTLY IF EXISTS user_svc.idx_seller_profiles_admin_pending_created_keycloak");
        assertThat(sql).doesNotContain("RENAME TO");
        assertThat(sql).doesNotContainIgnoringCase("DROP TABLE");
        assertThat(sql).doesNotContainIgnoringCase("DELETE FROM");
        assertThat(sql).doesNotContainIgnoringCase("ALTER TABLE");
    }

    @Test
    void renamesHappenInFollowUpTransactionalMigration() throws IOException {
        // V15 performs only the transactional renames V14 cannot contain.
        String sql = migrationSql("V15__admin_cursor_raw_id_rename.sql");
        assertThat(sql).contains("RENAME TO idx_buyer_profiles_admin_name_keycloak;");
        assertThat(sql).contains("RENAME TO idx_seller_profiles_admin_pending_created_keycloak;");
        assertThat(sql).doesNotContain("CREATE INDEX");
        assertThat(sql).doesNotContain("DROP INDEX");
        assertThat(sql).doesNotContainIgnoringCase("DROP TABLE");
        assertThat(sql).doesNotContainIgnoringCase("DELETE FROM");
    }
}

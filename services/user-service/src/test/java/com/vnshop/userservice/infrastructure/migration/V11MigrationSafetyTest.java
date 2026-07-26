package com.vnshop.userservice.infrastructure.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class V11MigrationSafetyTest {

    @Test
    void refusesToDropLegacyPlaintextBeforeKeyAwareBackfill() throws IOException {
        String sql = migrationSql();

        assertThat(sql).contains("bank_account IS NOT NULL");
        assertThat(sql).contains("RAISE EXCEPTION");
        assertThat(sql).contains("DROP COLUMN IF EXISTS bank_account");
        assertThat(sql).doesNotContainIgnoringCase("UPDATE user_svc.seller_profiles");
    }

    private static String migrationSql() throws IOException {
        try (InputStream input = V11MigrationSafetyTest.class.getResourceAsStream(
                "/db/migration/V11__remove_legacy_payout_destination.sql")) {
            assertThat(input).as("V11 migration resource").isNotNull();
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}

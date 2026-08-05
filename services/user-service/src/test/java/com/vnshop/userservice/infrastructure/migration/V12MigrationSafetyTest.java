package com.vnshop.userservice.infrastructure.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class V12MigrationSafetyTest {

    @Test
    void keepsLegacyDuplicatePhonesIntactWhileEnforcingClaimsForNewWrites() throws IOException {
        String sql = migrationSql();

        assertThat(sql).contains("ADD COLUMN IF NOT EXISTS phone_claim");
        assertThat(sql).contains("CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_profiles_phone_claim");
        assertThat(sql).contains("phone_claim = b.phone");
        assertThat(sql).doesNotContainIgnoringCase("SET phone = NULL");
        assertThat(sql).doesNotContainIgnoringCase("DELETE FROM user_svc.buyer_profiles");
    }

    private static String migrationSql() throws IOException {
        try (InputStream input = V12MigrationSafetyTest.class.getResourceAsStream(
                "/db/migration/V12__buyer_phone_claims.sql")) {
            assertThat(input).as("V12 migration resource").isNotNull();
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}

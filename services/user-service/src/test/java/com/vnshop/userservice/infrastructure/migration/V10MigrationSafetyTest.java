package com.vnshop.userservice.infrastructure.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class V10MigrationSafetyTest {

    @Test
    void v10KeepsLegacyPlaintextUntilAnEncryptedBackfillCanBeVerified() throws IOException {
        String sql = migrationSql();

        assertThat(sql).contains("ADD COLUMN IF NOT EXISTS destination_ciphertext");
        assertThat(sql).contains("ALTER COLUMN bank_account DROP NOT NULL");
        assertThat(sql).doesNotContainIgnoringCase("DROP COLUMN bank_account");
        assertThat(sql).doesNotContain("NONE-LEGACY");
        assertThat(sql).doesNotContainIgnoringCase("UPDATE user_svc.seller_profiles");
    }

    @Test
    void v10DoesNotInventEncryptedMaterialForExistingRows() throws IOException {
        String sql = migrationSql();

        assertThat(sql).doesNotContain("destination_ciphertext =");
        assertThat(sql).doesNotContain("destination_key_version =");
        assertThat(sql).doesNotContain("gen_random_uuid");
        assertThat(sql).doesNotContain("digest(");
    }

    private static String migrationSql() throws IOException {
        try (InputStream input = V10MigrationSafetyTest.class.getResourceAsStream(
                "/db/migration/V10__secure_payout_destination.sql")) {
            assertThat(input).as("V10 migration resource").isNotNull();
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}

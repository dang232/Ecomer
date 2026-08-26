package com.vnshop.orderservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class CompensationOutboxMigrationContractTest {

    @Test
    void compensationOutboxMigrationDefinesClaimAndIdempotencyFields() throws Exception {
        String sql = Files.readString(
                Path.of("src/main/resources/db/migration/V38__saga_compensation_outbox.sql"),
                StandardCharsets.UTF_8);

        assertThat(sql)
                .contains("CREATE TABLE IF NOT EXISTS order_svc.saga_compensation_outbox")
                .contains("saga_id VARCHAR(36) NOT NULL")
                .contains("step VARCHAR(64) NOT NULL")
                .contains("operation_id VARCHAR(255) NOT NULL")
                .contains("attempt_count INTEGER NOT NULL DEFAULT 0")
                .contains("UNIQUE (operation_id)");
    }
}

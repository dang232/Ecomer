package com.vnshop.orderservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class AdminCursorMigrationContractTest {
    @Test
    void migrationContainsCursorAndPrefixSearchIndexes() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V33__admin_cursor_indexes.sql"),
                StandardCharsets.UTF_8);
        assertThat(sql).contains("idx_orders_admin_cursor_status_created_id")
                .contains("idx_orders_admin_cursor_created_id")
                .contains("idx_disputes_admin_cursor_status_created_id")
                .contains("lower(order_number)")
                .contains("lower(buyer_reason)")
                .contains("lower(dispute_id::text)")
                .doesNotContain("pg_trgm");
    }
}

package com.vnshop.productservice;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class MigrationContractTest {
    @Test
    void adminQueueIndexesAreConcurrentAndNonTransactional() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V18__admin_cursor_queue_indexes.sql"));
        assertThat(sql).contains("-- flyway:executeInTransaction=false")
                .contains("CREATE INDEX CONCURRENTLY")
                .contains("idx_reviews_admin_pending_created_id")
                .contains("idx_videos_admin_queue_created_id");
    }

    @Test
    void variantParcelColumnsAreBackfilledAndConstrained() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V20__variant_parcel_metadata.sql"));

        assertThat(sql)
                .contains("weight_grams INTEGER")
                .contains("length_mm INTEGER")
                .contains("width_mm INTEGER")
                .contains("height_mm INTEGER")
                .contains("declared_value_minor BIGINT")
                .contains("UPDATE product_svc.product_variants")
                .contains("parcel_length_cm * 10")
                .contains("price_amount")
                .contains("SET NOT NULL")
                .contains("weight_grams > 0")
                .contains("length_mm BETWEEN 1 AND 2000")
                .contains("width_mm BETWEEN 1 AND 2000")
                .contains("height_mm BETWEEN 1 AND 2000")
                .contains("declared_value_minor BETWEEN 0 AND 999999999")
                .doesNotContain("product_svc.products");
    }
}

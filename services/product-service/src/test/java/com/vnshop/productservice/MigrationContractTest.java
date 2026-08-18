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
    void variantParcelColumnsAreNullableAndHaveNoSyntheticDefaults() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V19__variant_parcel_dimensions.sql"));

        assertThat(sql)
                .contains("parcel_weight_grams INTEGER")
                .contains("parcel_length_cm INTEGER")
                .contains("parcel_width_cm INTEGER")
                .contains("parcel_height_cm INTEGER")
                .doesNotContain("NOT NULL")
                .doesNotContain("DEFAULT");
    }
}

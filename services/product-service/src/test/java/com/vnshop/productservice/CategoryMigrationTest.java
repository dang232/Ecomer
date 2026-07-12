package com.vnshop.productservice;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class CategoryMigrationTest {
    @Test
    void backfillDeduplicatesCategoriesBeforeAssigningSortOrder() throws IOException {
        try (var stream = getClass().getResourceAsStream("/db/migration/V8__category_taxonomy.sql")) {
            assertThat(stream).isNotNull();
            String migration = new String(stream.readAllBytes(), StandardCharsets.UTF_8);

            assertThat(migration)
                    .contains("WITH distinct_categories AS")
                    .contains("FROM distinct_categories");
        }
    }
}

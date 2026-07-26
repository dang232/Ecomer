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

    @Test
    void canonicalSeedContainsEveryStorefrontCategoryAndIsIdempotent() throws IOException {
        try (var stream = getClass().getResourceAsStream("/db/migration/V16__canonical_category_seed.sql")) {
            assertThat(stream).isNotNull();
            String migration = new String(stream.readAllBytes(), StandardCharsets.UTF_8);

            assertThat(migration)
                    .contains("'electronics'")
                    .contains("'fashion'")
                    .contains("'home'")
                    .contains("'software'")
                    .contains("'beauty'")
                    .contains("'sports'")
                    .contains("'books'")
                    .contains("'automotive'")
                    .contains("'digital'")
                    .contains("'food'")
                    .contains("ON CONFLICT (id) DO UPDATE");
        }
    }
}

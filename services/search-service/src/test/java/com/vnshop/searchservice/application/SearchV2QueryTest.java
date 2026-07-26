package com.vnshop.searchservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class SearchV2QueryTest {
    @Test
    void canonicalFiltersIncludeSortedTagsAndMinimumRating() {
        SearchV2Query query = new SearchV2Query(
                "phone", null, null, null, null, 4.0f,
                List.of("Wireless", "bluetooth", "wireless"), CursorSort.NEWEST,
                null, null, null, null, 20, false);

        assertThat(query.tags()).containsExactly("bluetooth", "wireless");
        assertThat(query.canonicalFilters()).contains("4", "bluetooth,wireless");
    }

    @Test
    void rejectsMinimumRatingOutsideFiveStarRange() {
        assertThatThrownBy(() -> new SearchV2Query(
                null, null, null, null, null, 5.1f, List.of(), CursorSort.NEWEST,
                null, null, null, null, 20, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("minRating");
    }
}

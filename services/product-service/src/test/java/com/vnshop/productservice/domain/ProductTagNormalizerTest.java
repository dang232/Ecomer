package com.vnshop.productservice.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class ProductTagNormalizerTest {

    private final ProductTagNormalizer normalizer = new ProductTagNormalizer(new ProductTagPolicy(3, 12, 20));

    @Test
    void normalizesAndDeduplicatesTagsInDeterministicOrder() {
        List<ProductTag> tags = normalizer.normalize(List.of("  Wireless  ", "wireless", "Bluetooth"));

        assertThat(tags).extracting(ProductTag::canonicalKey)
                .containsExactly("bluetooth", "wireless");
        assertThat(tags).extracting(ProductTag::displayLabel)
                .containsExactly("Bluetooth", "Wireless");
    }

    @Test
    void rejectsTagThatExceedsConfiguredLength() {
        assertThatThrownBy(() -> normalizer.normalize(List.of("abcdefghijklmnop")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("tag");
    }

    @Test
    void rejectsTooManyTags() {
        assertThatThrownBy(() -> normalizer.normalize(List.of("one", "two", "three", "four")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("tags");
    }

    @Test
    void rejectsAggregateLength() {
        assertThatThrownBy(() -> normalizer.normalize(List.of("abcdefgh", "ijklmnop", "qrstuvwx")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("length");
    }
}

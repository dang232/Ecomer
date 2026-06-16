package com.vnshop.userservice.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FullNameTest {

    @Test
    void of_composesFirstAndLastWithSingleSpace() {
        FullName n = FullName.of("Alice", "Nguyen");
        assertThat(n.firstName()).isEqualTo("Alice");
        assertThat(n.lastName()).isEqualTo("Nguyen");
        assertThat(n.value()).isEqualTo("Alice Nguyen");
    }

    @Test
    void of_trimsSurroundingWhitespace() {
        FullName n = FullName.of("  Alice  ", "  Nguyen  ");
        assertThat(n.value()).isEqualTo("Alice Nguyen");
    }

    @Test
    void of_nullFirstName_throws() {
        assertThatThrownBy(() -> FullName.of(null, "Nguyen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("firstName");
    }

    @Test
    void of_blankFirstName_throws() {
        assertThatThrownBy(() -> FullName.of("   ", "Nguyen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("firstName");
    }

    @Test
    void of_blankLastName_isAllowedAndValueEqualsFirstName() {
        // Upsert path passes a single composed name; lastName may be blank.
        FullName n = FullName.of("Alice", "");
        assertThat(n.value()).isEqualTo("Alice");
    }

    @Test
    void fromComposed_wrapsWholeNameInFirstName() {
        FullName n = FullName.fromComposed("Alice Nguyen");
        assertThat(n.firstName()).isEqualTo("Alice Nguyen");
        assertThat(n.lastName()).isEqualTo("");
        assertThat(n.value()).isEqualTo("Alice Nguyen");
    }

    @Test
    void fromComposed_trimsAndIgnoresTrailingSpace() {
        FullName n = FullName.fromComposed("  Alice  ");
        assertThat(n.value()).isEqualTo("Alice");
    }

    @Test
    void fromComposed_nullOrBlank_throws() {
        assertThatThrownBy(() -> FullName.fromComposed(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> FullName.fromComposed("   "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

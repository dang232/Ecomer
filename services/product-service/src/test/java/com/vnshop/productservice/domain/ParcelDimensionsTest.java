package com.vnshop.productservice.domain;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ParcelDimensionsTest {
    @Test
    void rejectsNonPositiveParcelValues() {
        assertThatThrownBy(() -> new ParcelDimensions(0, 30, 20, 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ParcelDimensions(1500, 0, 20, 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ParcelDimensions(1500, 30, 0, 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ParcelDimensions(1500, 30, 20, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

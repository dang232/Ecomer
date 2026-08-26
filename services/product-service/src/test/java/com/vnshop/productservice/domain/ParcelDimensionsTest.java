package com.vnshop.productservice.domain;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.api.Test;

class ParcelDimensionsTest {
    @Test
    void rejectsNonPositiveParcelValues() {
        assertThatThrownBy(() -> new ParcelDimensions(0, 300, 200, 100, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ParcelDimensions(1500, 0, 200, 100, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ParcelDimensions(1500, 300, 0, 100, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ParcelDimensions(1500, 300, 200, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @MethodSource("invalidBounds")
    void rejectsValuesOutsideParcelBounds(int weightGrams, int lengthMm, int widthMm, int heightMm,
                                          int declaredValueMinor) {
        assertThatThrownBy(() -> new ParcelDimensions(
                weightGrams, lengthMm, widthMm, heightMm, declaredValueMinor))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsValidMillimetreParcelAndDeclaredValue() {
        ParcelDimensions parcel = new ParcelDimensions(1500, 300, 200, 100, 999999999);

        org.assertj.core.api.Assertions.assertThat(parcel.weightGrams()).isEqualTo(1500);
        org.assertj.core.api.Assertions.assertThat(parcel.lengthMm()).isEqualTo(300);
        org.assertj.core.api.Assertions.assertThat(parcel.widthMm()).isEqualTo(200);
        org.assertj.core.api.Assertions.assertThat(parcel.heightMm()).isEqualTo(100);
        org.assertj.core.api.Assertions.assertThat(parcel.declaredValueMinor()).isEqualTo(999999999);
    }

    private static Stream<Arguments> invalidBounds() {
        return Stream.of(
                Arguments.of(1500, 300, 200, 100, -1),
                Arguments.of(1500, 0, 200, 100, 0),
                Arguments.of(1500, 2001, 200, 100, 0),
                Arguments.of(1500, 300, 0, 100, 0),
                Arguments.of(1500, 300, 2001, 100, 0),
                Arguments.of(1500, 300, 200, 0, 0),
                Arguments.of(1500, 300, 200, 2001, 0),
                Arguments.of(1500, 300, 200, 100, 1000000000));
    }
}

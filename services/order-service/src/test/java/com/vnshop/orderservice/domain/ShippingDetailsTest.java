package com.vnshop.orderservice.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ShippingDetailsTest {

    @Test
    void contactOnlyConstructorLeavesParcelMetadataAbsent() {
        ShippingDetails details = new ShippingDetails(
                "Nguyen Van A", "+84912345678", "W-001", "D-001", "P-001");

        assertThat(details.weightGrams()).isNull();
        assertThat(details.lengthCm()).isNull();
        assertThat(details.widthCm()).isNull();
        assertThat(details.heightCm()).isNull();
    }

    @Test
    void rejectsPartialParcelMetadata() {
        assertThatThrownBy(() -> new ShippingDetails(
                "Nguyen Van A", "+84912345678", "W-001", "D-001", "P-001",
                1500, null, 20, 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("parcel dimensions and weight must be provided together");
    }

    @Test
    void preservesFullParcelMetadata() {
        ShippingDetails details = new ShippingDetails(
                "Nguyen Van A", "+84912345678", "W-001", "D-001", "P-001",
                1500, 30, 20, 10);

        assertThat(details.weightGrams()).isEqualTo(1500);
        assertThat(details.lengthCm()).isEqualTo(30);
        assertThat(details.widthCm()).isEqualTo(20);
        assertThat(details.heightCm()).isEqualTo(10);
    }
}

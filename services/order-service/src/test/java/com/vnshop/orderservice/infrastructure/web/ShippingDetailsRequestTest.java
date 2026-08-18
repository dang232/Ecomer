package com.vnshop.orderservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ShippingDetailsRequestTest {

    @Test
    void acceptsContactAndAddressCodesWithoutParcelMetadata() {
        ShippingDetailsRequest request = new ShippingDetailsRequest(
                "Nguyen Van A", "+84912345678", "W-001", "D-001", "P-001",
                null, null, null, null);

        assertThat(request.toDomain().weightGrams()).isNull();
        assertThat(request.toDomain().lengthCm()).isNull();
        assertThat(request.toDomain().widthCm()).isNull();
        assertThat(request.toDomain().heightCm()).isNull();
    }

    @Test
    void rejectsPartialParcelMetadata() {
        assertThatThrownBy(() -> new ShippingDetailsRequest(
                "Nguyen Van A", "+84912345678", "W-001", "D-001", "P-001",
                1500, null, 20, 10).toDomain())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("parcel dimensions and weight must be provided together");
    }

    @Test
    void mapsFullParcelMetadataWhenSupplied() {
        ShippingDetailsRequest request = new ShippingDetailsRequest(
                "Nguyen Van A", "+84912345678", "W-001", "D-001", "P-001",
                1500, 30, 20, 10);

        assertThat(request.toDomain().weightGrams()).isEqualTo(1500);
        assertThat(request.toDomain().lengthCm()).isEqualTo(30);
        assertThat(request.toDomain().widthCm()).isEqualTo(20);
        assertThat(request.toDomain().heightCm()).isEqualTo(10);
    }
}

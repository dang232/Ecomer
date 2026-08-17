package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.domain.ShippingDetails;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ShippingDetailsRequest(
        @NotBlank String recipientName,
        @NotBlank String recipientPhone,
        @NotBlank String wardCode,
        @NotBlank String districtCode,
        @NotBlank String provinceCode,
        @NotNull @Positive Integer weightGrams,
        @NotNull @Positive Integer lengthCm,
        @NotNull @Positive Integer widthCm,
        @NotNull @Positive Integer heightCm) {

    ShippingDetails toDomain() {
        if (weightGrams == null || lengthCm == null || widthCm == null || heightCm == null) {
            throw new IllegalArgumentException("Parcel dimensions are required for live shipping checkout");
        }
        return new ShippingDetails(recipientName, recipientPhone, wardCode, districtCode, provinceCode,
                weightGrams, lengthCm, widthCm, heightCm);
    }
}

package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.domain.ShippingDetails;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record ShippingDetailsRequest(
        @NotBlank String recipientName,
        @NotBlank String recipientPhone,
        @NotBlank String wardCode,
        @NotBlank String districtCode,
        @NotBlank String provinceCode,
        @Positive Integer weightGrams,
        @Positive Integer lengthCm,
        @Positive Integer widthCm,
        @Positive Integer heightCm) {

    ShippingDetails toDomain() {
        return new ShippingDetails(recipientName, recipientPhone, wardCode, districtCode, provinceCode,
                weightGrams, lengthCm, widthCm, heightCm);
    }
}

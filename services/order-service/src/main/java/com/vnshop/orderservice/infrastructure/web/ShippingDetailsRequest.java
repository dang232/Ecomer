package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.domain.ShippingDetails;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record ShippingDetailsRequest(
        @NotBlank String recipientName,
        @NotBlank String recipientPhone,
        @NotBlank String wardCode,
        @NotBlank String districtCode,
        @NotBlank String provinceCode,
        @Min(1) int weightGrams,
        @Min(1) int lengthCm,
        @Min(1) int widthCm,
        @Min(1) int heightCm) {

    ShippingDetails toDomain() {
        return new ShippingDetails(recipientName, recipientPhone, wardCode, districtCode, provinceCode,
                weightGrams, lengthCm, widthCm, heightCm);
    }
}

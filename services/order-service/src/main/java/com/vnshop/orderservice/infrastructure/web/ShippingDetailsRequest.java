package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.domain.ShippingDetails;
import jakarta.validation.constraints.NotBlank;

public record ShippingDetailsRequest(
        @NotBlank String recipientName,
        @NotBlank String recipientPhone,
        @NotBlank String wardCode,
        @NotBlank String districtCode,
        @NotBlank String provinceCode) {

    ShippingDetails toDomain() {
        return new ShippingDetails(recipientName, recipientPhone, wardCode, districtCode, provinceCode,
                1_000, 30, 20, 10);
    }
}

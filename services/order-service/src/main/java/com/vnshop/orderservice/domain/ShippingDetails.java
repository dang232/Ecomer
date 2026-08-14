package com.vnshop.orderservice.domain;

/** Carrier-facing checkout data captured with the order. */
public record ShippingDetails(
        String recipientName,
        String recipientPhone,
        String wardCode,
        String districtCode,
        String provinceCode,
        int weightGrams,
        int lengthCm,
        int widthCm,
        int heightCm) {

    public ShippingDetails {
        requireNonBlank(recipientName, "recipientName");
        requireNonBlank(recipientPhone, "recipientPhone");
        requireNonBlank(wardCode, "wardCode");
        requireNonBlank(districtCode, "districtCode");
        requireNonBlank(provinceCode, "provinceCode");
        if (weightGrams <= 0 || lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) {
            throw new IllegalArgumentException("parcel dimensions and weight must be positive");
        }
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}

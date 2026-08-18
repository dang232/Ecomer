package com.vnshop.orderservice.domain;

/** Carrier-facing checkout data captured with the order. */
public record ShippingDetails(
        String recipientName,
        String recipientPhone,
        String wardCode,
        String districtCode,
        String provinceCode,
        Integer weightGrams,
        Integer lengthCm,
        Integer widthCm,
        Integer heightCm) {

    public ShippingDetails(String recipientName, String recipientPhone, String wardCode,
                           String districtCode, String provinceCode) {
        this(recipientName, recipientPhone, wardCode, districtCode, provinceCode,
                null, null, null, null);
    }

    public ShippingDetails {
        requireNonBlank(recipientName, "recipientName");
        requireNonBlank(recipientPhone, "recipientPhone");
        requireNonBlank(wardCode, "wardCode");
        requireNonBlank(districtCode, "districtCode");
        requireNonBlank(provinceCode, "provinceCode");
        boolean parcelAbsent = weightGrams == null && lengthCm == null && widthCm == null && heightCm == null;
        boolean parcelComplete = weightGrams != null && lengthCm != null && widthCm != null && heightCm != null;
        if (!parcelAbsent && !parcelComplete) {
            throw new IllegalArgumentException("parcel dimensions and weight must be provided together");
        }
        if (parcelComplete && (weightGrams <= 0 || lengthCm <= 0 || widthCm <= 0 || heightCm <= 0)) {
            throw new IllegalArgumentException("parcel dimensions and weight must be positive");
        }
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}

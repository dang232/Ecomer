package com.vnshop.productservice.domain;

public record ParcelDimensions(
        int weightGrams,
        int lengthCm,
        int widthCm,
        int heightCm) {

    public ParcelDimensions {
        if (weightGrams <= 0 || lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) {
            throw new IllegalArgumentException("parcel dimensions and weight must be positive");
        }
    }
}

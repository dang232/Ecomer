package com.vnshop.shippingservice.domain;

public record Parcel(int weightGrams, int lengthCm, int widthCm, int heightCm, long declaredValueMinor) {
    public Parcel(int weightGrams, int lengthCm, int widthCm, int heightCm) {
        this(weightGrams, lengthCm, widthCm, heightCm, 0L);
    }
}

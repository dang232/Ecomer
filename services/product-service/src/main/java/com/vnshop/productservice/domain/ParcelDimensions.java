package com.vnshop.productservice.domain;

public record ParcelDimensions(
        int weightGrams,
        int lengthMm,
        int widthMm,
        int heightMm,
        long declaredValueMinor) {

    public ParcelDimensions {
        if (weightGrams <= 0) {
            throw new IllegalArgumentException("weightGrams must be positive");
        }
        if (!inRange(lengthMm) || !inRange(widthMm) || !inRange(heightMm)) {
            throw new IllegalArgumentException("parcel dimensions must be between 1 and 2000mm");
        }
        if (declaredValueMinor < 0 || declaredValueMinor > 999999999) {
            throw new IllegalArgumentException("declaredValueMinor must be between 0 and 999999999");
        }
    }

    public ParcelDimensions(int weightGrams, int lengthCm, int widthCm, int heightCm) {
        this(weightGrams, lengthCm * 10, widthCm * 10, heightCm * 10, 0);
    }

    public int lengthCm() {
        return lengthMm / 10;
    }

    public int widthCm() {
        return widthMm / 10;
    }

    public int heightCm() {
        return heightMm / 10;
    }

    private static boolean inRange(int value) {
        return value >= 1 && value <= 2000;
    }
}

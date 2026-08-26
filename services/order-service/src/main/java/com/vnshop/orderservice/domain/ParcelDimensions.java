package com.vnshop.orderservice.domain;

import java.util.List;

public record ParcelDimensions(
        int weightGrams,
        int lengthCm,
        int widthCm,
        int heightCm,
        long declaredValueMinor) {

    public ParcelDimensions(int weightGrams, int lengthCm, int widthCm, int heightCm) {
        this(weightGrams, lengthCm, widthCm, heightCm, 0L);
    }

    public ParcelDimensions {
        if (weightGrams <= 0 || lengthCm <= 0 || widthCm <= 0 || heightCm <= 0 || declaredValueMinor < 0) {
            throw new IllegalArgumentException("parcel dimensions and weight must be positive");
        }
    }

    /**
     * Packs one seller sub-order on a fixed length axis: each unit contributes
     * its length, while width and height use the largest unit dimension.
     */
    public static ParcelDimensions aggregate(List<OrderItem> items, String sellerId) {
        int weightGrams = 0;
        int lengthCm = 0;
        int widthCm = 0;
        int heightCm = 0;
        long declaredValueMinor = 0;
        try {
            for (OrderItem item : items) {
                ParcelDimensions parcel = item.parcel();
                if (parcel == null) {
                    throw new IllegalStateException("trusted parcel metadata is required for seller " + sellerId);
                }
                weightGrams = Math.addExact(weightGrams, Math.multiplyExact(parcel.weightGrams(), item.quantity()));
                lengthCm = Math.addExact(lengthCm, Math.multiplyExact(parcel.lengthCm(), item.quantity()));
                widthCm = Math.max(widthCm, parcel.widthCm());
                heightCm = Math.max(heightCm, parcel.heightCm());
                declaredValueMinor = Math.addExact(declaredValueMinor,
                        Math.multiplyExact(parcel.declaredValueMinor(), item.quantity()));
            }
        } catch (ArithmeticException exception) {
            throw new IllegalStateException("parcel metadata exceeds shipping limits for seller " + sellerId,
                    exception);
        }
        return new ParcelDimensions(weightGrams, lengthCm, widthCm, heightCm, declaredValueMinor);
    }
}

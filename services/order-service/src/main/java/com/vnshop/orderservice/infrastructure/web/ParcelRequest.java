package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.domain.ParcelDimensions;
import jakarta.validation.constraints.NotNull;

public record ParcelRequest(
        @NotNull Integer weightGrams,
        @NotNull Integer lengthCm,
        @NotNull Integer widthCm,
        @NotNull Integer heightCm,
        Long declaredValueMinor) {

    ParcelDimensions toDomain() {
        return new ParcelDimensions(
                weightGrams,
                lengthCm,
                widthCm,
                heightCm,
                declaredValueMinor == null ? 0L : declaredValueMinor);
    }
}

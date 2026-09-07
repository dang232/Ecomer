package com.vnshop.orderservice.infrastructure.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record RequestReturnRequest(Long subOrderId, @NotBlank String reason, @Positive Integer returnedQuantity) {
    public RequestReturnRequest(Long subOrderId, String reason) {
        this(subOrderId, reason, null);
    }
}

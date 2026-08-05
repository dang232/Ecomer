package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.CalculateCheckoutUseCase;
import java.math.BigDecimal;

public record CheckoutBreakdownResponse(
        BigDecimal itemsTotal,
        BigDecimal shippingEstimate,
        BigDecimal discount,
        BigDecimal taxTotal,
        BigDecimal finalAmount
) {
    static CheckoutBreakdownResponse fromApplication(CalculateCheckoutUseCase.CheckoutBreakdown breakdown) {
        return new CheckoutBreakdownResponse(
                breakdown.itemsTotal(),
                breakdown.shippingEstimate(),
                breakdown.discount(),
                breakdown.taxTotal(),
                breakdown.finalAmount()
        );
    }
}

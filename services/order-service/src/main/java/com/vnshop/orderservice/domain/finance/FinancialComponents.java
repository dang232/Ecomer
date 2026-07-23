package com.vnshop.orderservice.domain.finance;

import java.math.BigDecimal;
import java.util.Objects;

public record FinancialComponents(
        BigDecimal itemGmvAmount,
        BigDecimal sellerFundedDiscountAmount,
        BigDecimal platformFundedDiscountAmount,
        BigDecimal buyerShippingChargeAmount,
        BigDecimal sellerShippingPayableAmount,
        BigDecimal taxChargedAmount,
        BigDecimal sellerTaxPayableAmount,
        BigDecimal commissionBaseAmount,
        BigDecimal platformCommissionAmount,
        BigDecimal sellerPayableAmount,
        BigDecimal buyerPaidAmount,
        String currency) {

    public FinancialComponents {
        Objects.requireNonNull(itemGmvAmount, "itemGmvAmount is required");
        Objects.requireNonNull(sellerFundedDiscountAmount, "sellerFundedDiscountAmount is required");
        Objects.requireNonNull(platformFundedDiscountAmount, "platformFundedDiscountAmount is required");
        Objects.requireNonNull(buyerShippingChargeAmount, "buyerShippingChargeAmount is required");
        Objects.requireNonNull(sellerShippingPayableAmount, "sellerShippingPayableAmount is required");
        Objects.requireNonNull(taxChargedAmount, "taxChargedAmount is required");
        Objects.requireNonNull(sellerTaxPayableAmount, "sellerTaxPayableAmount is required");
        Objects.requireNonNull(commissionBaseAmount, "commissionBaseAmount is required");
        Objects.requireNonNull(platformCommissionAmount, "platformCommissionAmount is required");
        Objects.requireNonNull(sellerPayableAmount, "sellerPayableAmount is required");
        Objects.requireNonNull(buyerPaidAmount, "buyerPaidAmount is required");
        if (!"VND".equals(currency)) {
            throw new IllegalArgumentException("currency must be VND");
        }
    }
}

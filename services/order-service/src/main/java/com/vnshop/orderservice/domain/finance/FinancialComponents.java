package com.vnshop.orderservice.domain.finance;

import java.math.BigDecimal;
import java.util.Objects;
import java.math.RoundingMode;

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

    /** Returns the frozen allocation components attributable to a buyer refund. */
    public FinancialComponents reversalForBuyerAmount(BigDecimal buyerRefundAmount) {
        Objects.requireNonNull(buyerRefundAmount, "buyerRefundAmount is required");
        if (buyerRefundAmount.signum() <= 0 || buyerRefundAmount.compareTo(buyerPaidAmount) > 0) {
            throw new IllegalArgumentException("buyerRefundAmount must be within the allocation");
        }
        if (buyerRefundAmount.compareTo(buyerPaidAmount) == 0) return this;
        BigDecimal ratio = buyerRefundAmount.divide(buyerPaidAmount, 12, RoundingMode.HALF_UP);
        return new FinancialComponents(
                scale(itemGmvAmount.multiply(ratio)), scale(sellerFundedDiscountAmount.multiply(ratio)),
                scale(platformFundedDiscountAmount.multiply(ratio)), scale(buyerShippingChargeAmount.multiply(ratio)),
                scale(sellerShippingPayableAmount.multiply(ratio)), scale(taxChargedAmount.multiply(ratio)),
                scale(sellerTaxPayableAmount.multiply(ratio)), scale(commissionBaseAmount.multiply(ratio)),
                scale(platformCommissionAmount.multiply(ratio)), scale(sellerPayableAmount.multiply(ratio)),
                buyerRefundAmount, currency);
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(0, RoundingMode.HALF_UP);
    }
}

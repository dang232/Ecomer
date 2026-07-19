package com.vnshop.sellerfinanceservice.domain;

import com.vnshop.sellerfinanceservice.domain.port.out.CommissionRatePort;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

public class CommissionCalculator {
    private final CommissionRatePort rateConfig;

    public CommissionCalculator(CommissionRatePort rateConfig) {
        this.rateConfig = Objects.requireNonNull(rateConfig, "rateConfig is required");
    }

    public CommissionBreakdown calculate(BigDecimal orderAmount, CommissionTier tier) {
        Objects.requireNonNull(orderAmount, "orderAmount is required");
        Objects.requireNonNull(tier, "tier is required");
        if (orderAmount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("orderAmount must not be negative");
        }
        BigDecimal rate = rateConfig.rateFor(tier);
        BigDecimal commission = orderAmount.multiply(rate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal sellerNet = orderAmount.subtract(commission).setScale(2, RoundingMode.HALF_UP);
        return new CommissionBreakdown(commission, sellerNet);
    }

    public record CommissionBreakdown(BigDecimal commission, BigDecimal sellerNet) {
    }
}

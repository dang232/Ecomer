package com.vnshop.sellerfinanceservice.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class CommissionCalculatorTest {
    @Test
    void calculatesStandardCommissionAndSellerNet() {
        CommissionCalculator calculator = new CommissionCalculator(
                tier -> BigDecimal.valueOf(0.10));

        CommissionCalculator.CommissionBreakdown breakdown = calculator.calculate(BigDecimal.valueOf(100000), CommissionTier.STANDARD);

        assertThat(breakdown.commission()).isEqualByComparingTo("10000.00");
        assertThat(breakdown.sellerNet()).isEqualByComparingTo("90000.00");
    }
}

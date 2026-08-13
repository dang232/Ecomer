package com.vnshop.paymentservice.infrastructure.stripe;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class StripeChargebackAmountTest {
    @Test
    void convertsUsdMinorUnitsToMajorUnits() {
        assertThat(StripeChargebackAmount.toMajorUnits(125000L, "usd"))
                .isEqualByComparingTo("1250.00");
    }

    @Test
    void preservesZeroDecimalCurrencyAmounts() {
        assertThat(StripeChargebackAmount.toMajorUnits(125000L, "jpy"))
                .isEqualByComparingTo("125000");
    }
}

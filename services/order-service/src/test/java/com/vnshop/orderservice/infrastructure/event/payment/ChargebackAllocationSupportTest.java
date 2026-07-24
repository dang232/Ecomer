package com.vnshop.orderservice.infrastructure.event.payment;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.finance.FinancialComponents;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ChargebackAllocationSupportTest {
    @Test
    void portionsCarryOnlyTheAmountRemainingAfterEarlierReversals() {
        SubOrderFinancialAllocation allocation = allocation(new BigDecimal("100000"));

        List<ChargebackAllocationSupport.Portion> portions = ChargebackAllocationSupport.portions(
                List.of(allocation), new BigDecimal("90000"), ignored -> new BigDecimal("25000"));

        assertThat(portions).hasSize(1);
        assertThat(portions.getFirst().components().buyerPaidAmount()).isEqualByComparingTo("25000");
    }

    private static SubOrderFinancialAllocation allocation(BigDecimal buyerPaid) {
        return new SubOrderFinancialAllocation(
                UUID.randomUUID(), 1, UUID.randomUUID(), 42L, "seller-1", CommissionTier.STANDARD,
                new BigDecimal("0.10"), new FinancialComponents(
                        buyerPaid, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, buyerPaid, new BigDecimal("10000"),
                        new BigDecimal("90000"), buyerPaid, "VND"),
                SubOrderFinancialAllocation.Source.NATIVE_V1, Instant.now());
    }
}

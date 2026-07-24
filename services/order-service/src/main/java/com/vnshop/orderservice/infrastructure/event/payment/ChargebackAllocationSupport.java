package com.vnshop.orderservice.infrastructure.event.payment;

import com.vnshop.orderservice.domain.finance.FinancialComponents;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

final class ChargebackAllocationSupport {
    private ChargebackAllocationSupport() {
    }

    static List<Portion> portions(List<SubOrderFinancialAllocation> allocations, BigDecimal challengedAmount) {
        return portions(allocations, challengedAmount,
                allocation -> allocation.components().buyerPaidAmount());
    }

    static List<Portion> portions(
            List<SubOrderFinancialAllocation> allocations,
            BigDecimal challengedAmount,
            Function<SubOrderFinancialAllocation, BigDecimal> availableAmount) {
        Objects.requireNonNull(allocations, "allocations is required");
        Objects.requireNonNull(availableAmount, "availableAmount is required");
        if (challengedAmount == null || challengedAmount.signum() <= 0) {
            return allocations.stream()
                    .map(allocation -> portionFor(allocation, availableAmount.apply(allocation)))
                    .filter(Objects::nonNull)
                    .toList();
        }

        BigDecimal remaining = challengedAmount;
        List<Portion> portions = new ArrayList<>();
        for (SubOrderFinancialAllocation allocation : allocations) {
            if (remaining.signum() <= 0) break;
            BigDecimal allocationAmount = allocation.components().buyerPaidAmount()
                    .min(Objects.requireNonNull(availableAmount.apply(allocation), "available amount is required"));
            if (allocationAmount.signum() <= 0) continue;
            BigDecimal portion = allocationAmount.min(remaining);
            portions.add(new Portion(allocation, allocation.components().reversalForBuyerAmount(portion)));
            remaining = remaining.subtract(portion);
        }
        return List.copyOf(portions);
    }

    private static Portion portionFor(SubOrderFinancialAllocation allocation, BigDecimal availableAmount) {
        BigDecimal amount = allocation.components().buyerPaidAmount()
                .min(Objects.requireNonNull(availableAmount, "available amount is required"));
        return amount.signum() <= 0
                ? null
                : new Portion(allocation, allocation.components().reversalForBuyerAmount(amount));
    }

    record Portion(SubOrderFinancialAllocation allocation, FinancialComponents components) {
    }
}

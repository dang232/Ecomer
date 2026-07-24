package com.vnshop.orderservice.infrastructure.event.payment;

import com.vnshop.orderservice.domain.finance.FinancialComponents;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

final class ChargebackAllocationSupport {
    private ChargebackAllocationSupport() {
    }

    static List<Portion> portions(List<SubOrderFinancialAllocation> allocations, BigDecimal challengedAmount) {
        if (challengedAmount == null || challengedAmount.signum() <= 0) {
            return allocations.stream().map(allocation -> new Portion(allocation, allocation.components())).toList();
        }

        BigDecimal remaining = challengedAmount;
        List<Portion> portions = new ArrayList<>();
        for (SubOrderFinancialAllocation allocation : allocations) {
            if (remaining.signum() <= 0) break;
            BigDecimal allocationAmount = allocation.components().buyerPaidAmount();
            if (allocationAmount.signum() <= 0) continue;
            BigDecimal portion = allocationAmount.min(remaining);
            portions.add(new Portion(allocation, allocation.components().reversalForBuyerAmount(portion)));
            remaining = remaining.subtract(portion);
        }
        return List.copyOf(portions);
    }

    record Portion(SubOrderFinancialAllocation allocation, FinancialComponents components) {
    }
}

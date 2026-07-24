package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;

public interface SellerFinanceAdjustmentPublisherPort {
    void publishCredit(SubOrderFinancialAllocation allocation, String causationId);

    default void publishCredit(SubOrderFinancialAllocation allocation) {
        publishCredit(allocation, allocation.allocationId().toString());
    }

    void publishRelease(SubOrderFinancialAllocation allocation, String buyerId);
}

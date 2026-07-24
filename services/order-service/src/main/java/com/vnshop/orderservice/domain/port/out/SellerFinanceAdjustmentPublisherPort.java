package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.finance.FinancialComponents;
import java.util.UUID;

public interface SellerFinanceAdjustmentPublisherPort {
    void publishCredit(SubOrderFinancialAllocation allocation, String causationId);

    default void publishCredit(SubOrderFinancialAllocation allocation) {
        publishCredit(allocation, allocation.allocationId().toString());
    }

    void publishRelease(SubOrderFinancialAllocation allocation, String buyerId);

    default void publishReversal(SubOrderFinancialAllocation allocation, UUID reversalId,
                                 FinancialComponents components) {
        // Legacy adapters may deploy before reversal events are enabled.
    }

    default void publishChargebackHold(SubOrderFinancialAllocation allocation, UUID chargebackId,
                                       FinancialComponents components) {
    }

    default void publishChargebackRelease(SubOrderFinancialAllocation allocation, UUID chargebackId,
                                          FinancialComponents components) {
    }

    default void publishChargebackFinalize(SubOrderFinancialAllocation allocation, UUID chargebackId,
                                           FinancialComponents components) {
    }
}

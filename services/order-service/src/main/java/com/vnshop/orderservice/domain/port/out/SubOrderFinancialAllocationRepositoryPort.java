package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import java.util.List;
import java.util.UUID;

public interface SubOrderFinancialAllocationRepositoryPort {
    void saveAll(List<SubOrderFinancialAllocation> allocations);

    List<SubOrderFinancialAllocation> findByOrderId(UUID orderId);
}

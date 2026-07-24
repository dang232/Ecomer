package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.finance.FinancialReversal;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface FinancialReversalRepositoryPort {
    FinancialReversal reserve(FinancialReversal reversal, BigDecimal allocationBuyerPaidAmount);

    BigDecimal remainingBuyerAmount(UUID allocationId, BigDecimal allocationBuyerPaidAmount);

    List<FinancialReversal> findByReversalId(UUID reversalId);

    FinancialReversal resolve(UUID reversalId, UUID allocationId, FinancialReversal.ReversalStatus status);
}

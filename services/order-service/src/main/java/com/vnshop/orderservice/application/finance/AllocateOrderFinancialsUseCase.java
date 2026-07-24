package com.vnshop.orderservice.application.finance;

import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.finance.FinancialComponents;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public class AllocateOrderFinancialsUseCase {
    private static final Map<CommissionTier, BigDecimal> COMMISSION_RATES = Map.of(
            CommissionTier.STANDARD, new BigDecimal("0.10"),
            CommissionTier.VERIFIED, new BigDecimal("0.08"),
            CommissionTier.PREFERRED, new BigDecimal("0.05"),
            CommissionTier.MALL, new BigDecimal("0.03"));
    private final SubOrderFinancialAllocationRepositoryPort repository;

    public AllocateOrderFinancialsUseCase(SubOrderFinancialAllocationRepositoryPort repository) {
        this.repository = Objects.requireNonNull(repository, "repository is required");
    }

    public List<SubOrderFinancialAllocation> allocate(Order order) {
        Objects.requireNonNull(order, "order is required");
        if (order.subOrders().stream().anyMatch(subOrder -> subOrder.id() == null)) {
            throw new IllegalStateException("subOrder IDs must be generated before allocation");
        }
        Map<Long, BigDecimal> itemGmv = order.subOrders().stream().collect(java.util.stream.Collectors.toMap(
                SubOrder::id, subOrder -> subOrder.itemsTotal().amount()));
        BigDecimal totalGmv = order.itemsTotal().amount();
        Map<Long, BigDecimal> platformDiscounts = proportional(order.discount().amount(), itemGmv, totalGmv);

        List<SubOrderFinancialAllocation> allocations = order.subOrders().stream().map(subOrder -> {
            BigDecimal gmv = itemGmv.get(subOrder.id());
            BigDecimal platformDiscount = platformDiscounts.get(subOrder.id());
            BigDecimal commissionBase = gmv;
            BigDecimal rate = COMMISSION_RATES.get(subOrder.commissionTier());
            BigDecimal commission = commissionBase.multiply(rate).setScale(0, RoundingMode.HALF_UP);
            BigDecimal sellerPayable = commissionBase.subtract(commission);
            BigDecimal shipping = subOrder.shippingCost().amount();
            BigDecimal tax = subOrder.items().stream()
                    .map(item -> item.taxAmount() == null ? BigDecimal.ZERO : item.taxAmount())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            FinancialComponents components = new FinancialComponents(gmv, BigDecimal.ZERO, platformDiscount,
                    shipping, BigDecimal.ZERO, tax, BigDecimal.ZERO, commissionBase, commission, sellerPayable,
                    gmv.subtract(platformDiscount).add(shipping).add(tax), "VND");
            return new SubOrderFinancialAllocation(UUID.randomUUID(), 1, order.id(), subOrder.id(),
                    subOrder.sellerId(), subOrder.commissionTier(), rate, components,
                    SubOrderFinancialAllocation.Source.NATIVE_V1, Instant.now());
        }).toList();
        verifyReconciliation(order, allocations);
        repository.saveAll(allocations);
        return allocations;
    }

    private static void verifyReconciliation(Order order, List<SubOrderFinancialAllocation> allocations) {
        assertReconciles("buyer paid", order.finalAmount().amount(), allocations,
                allocation -> allocation.components().buyerPaidAmount());
        assertReconciles("platform-funded discount", order.discount().amount(), allocations,
                allocation -> allocation.components().platformFundedDiscountAmount());
        assertReconciles("buyer shipping", order.shippingTotal().amount(), allocations,
                allocation -> allocation.components().buyerShippingChargeAmount());
        assertReconciles("tax charged", order.taxTotal().amount(), allocations,
                allocation -> allocation.components().taxChargedAmount());
    }

    private static void assertReconciles(
            String component,
            BigDecimal expected,
            List<SubOrderFinancialAllocation> allocations,
            java.util.function.Function<SubOrderFinancialAllocation, BigDecimal> value) {
        BigDecimal actual = allocations.stream().map(value).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (actual.compareTo(expected) != 0) {
            throw new IllegalStateException(component + " allocations must reconcile with the order total");
        }
    }

    private static Map<Long, BigDecimal> proportional(
            BigDecimal total, Map<Long, BigDecimal> weights, BigDecimal totalWeight) {
        Map<Long, BigDecimal> allocations = new HashMap<>();
        if (total.signum() == 0) {
            weights.keySet().forEach(id -> allocations.put(id, BigDecimal.ZERO));
            return allocations;
        }
        if (totalWeight.signum() == 0) throw new IllegalArgumentException("cannot allocate non-zero amount without GMV");
        BigDecimal allocated = BigDecimal.ZERO;
        for (Map.Entry<Long, BigDecimal> entry : weights.entrySet()) {
            BigDecimal share = total.multiply(entry.getValue()).divide(totalWeight, 0, RoundingMode.DOWN);
            allocations.put(entry.getKey(), share);
            allocated = allocated.add(share);
        }
        long remainder = total.subtract(allocated).longValueExact();
        List<Long> ids = weights.keySet().stream().sorted(Comparator.naturalOrder()).toList();
        for (int index = 0; index < remainder; index++) {
            Long id = ids.get(index % ids.size());
            allocations.compute(id, (ignored, amount) -> amount.add(BigDecimal.ONE));
        }
        return allocations;
    }
}

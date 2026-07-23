package com.vnshop.orderservice.application.finance;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AllocateOrderFinancialsUseCaseTest {

    @Test
    void snapshotsAuthoritativeOrderTotalsAndFrozenTierRates() {
        Order order = order(List.of(
                subOrder(11L, "seller-standard", 100L, CommissionTier.STANDARD),
                subOrder(12L, "seller-mall", 300L, CommissionTier.MALL)),
                40L, 20L, 40L);
        RecordingAllocations repository = new RecordingAllocations();

        List<SubOrderFinancialAllocation> allocations =
                new AllocateOrderFinancialsUseCase(repository).allocate(order);

        assertThat(allocations).hasSize(2);
        assertThat(allocations).extracting(a -> a.components().platformFundedDiscountAmount())
                .containsExactly(new BigDecimal("10"), new BigDecimal("30"));
        assertThat(allocations).extracting(a -> a.frozenCommissionRate())
                .containsExactly(new BigDecimal("0.10"), new BigDecimal("0.03"));
        assertThat(allocations).extracting(a -> a.components().commissionBaseAmount())
                .containsExactly(new BigDecimal("100"), new BigDecimal("300"));
        assertThat(allocations).extracting(a -> a.components().sellerPayableAmount())
                .containsExactly(new BigDecimal("90"), new BigDecimal("291"));
        assertThat(allocations).allSatisfy(a -> {
            assertThat(a.components().sellerFundedDiscountAmount()).isEqualByComparingTo("0");
            assertThat(a.components().sellerShippingPayableAmount()).isEqualByComparingTo("0");
            assertThat(a.components().sellerTaxPayableAmount()).isEqualByComparingTo("0");
            assertThat(a.components().currency()).isEqualTo("VND");
        });
        assertThat(repository.saved).containsExactlyElementsOf(allocations);
        assertThat(allocations.stream().map(a -> a.components().buyerPaidAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo(order.finalAmount().amount());
        assertThat(allocations.stream().map(a -> a.components().platformFundedDiscountAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo(order.discount().amount());
        assertThat(allocations.stream().map(a -> a.components().buyerShippingChargeAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo(order.shippingTotal().amount());
        assertThat(allocations.stream().map(a -> a.components().taxChargedAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo(order.taxTotal().amount());
    }

    @Test
    void assignsProportionalDiscountRemainderToAscendingSubOrderIds() {
        Order order = order(List.of(
                subOrder(20L, "seller-b", 1L, CommissionTier.STANDARD),
                subOrder(10L, "seller-a", 1L, CommissionTier.STANDARD),
                subOrder(30L, "seller-c", 1L, CommissionTier.STANDARD)),
                1L, 0L, 0L);

        List<SubOrderFinancialAllocation> allocations =
                new AllocateOrderFinancialsUseCase(ignored -> { }).allocate(order);

        assertThat(allocations).extracting(SubOrderFinancialAllocation::subOrderId)
                .containsExactly(20L, 10L, 30L);
        assertThat(allocations).extracting(a -> a.components().platformFundedDiscountAmount())
                .containsExactly(new BigDecimal("0"), new BigDecimal("1"), new BigDecimal("0"));
    }

    private static Order order(List<SubOrder> subOrders, long discount, long shipping, long tax) {
        Order order = new Order(UUID.randomUUID(), "buyer", new Address("street", null, "district", "city"),
                subOrders, "idempotency-" + UUID.randomUUID());
        subOrders.forEach(subOrder -> subOrder.setShippingCost(new Money(BigDecimal.valueOf(shipping)
                .multiply(subOrder.itemsTotal().amount())
                .divide(subOrders.stream().map(SubOrder::itemsTotal).map(Money::amount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)))));
        order.calculateTotals();
        order.applyDiscount(new Money(BigDecimal.valueOf(discount)));
        order.applyTax(new Money(BigDecimal.valueOf(tax)));
        return order;
    }

    private static SubOrder subOrder(Long id, String sellerId, long amount, CommissionTier tier) {
        return new SubOrder(id, sellerId, List.of(new OrderItem("product-" + sellerId, "sku", sellerId,
                "Product", 1, new Money(BigDecimal.valueOf(amount)), null)),
                com.vnshop.orderservice.domain.FulfillmentStatus.PENDING_ACCEPTANCE, Money.ZERO,
                "STANDARD", null, null, tier);
    }

    private static final class RecordingAllocations implements SubOrderFinancialAllocationRepositoryPort {
        private final List<SubOrderFinancialAllocation> saved = new ArrayList<>();

        @Override
        public void saveAll(List<SubOrderFinancialAllocation> allocations) {
            saved.addAll(allocations);
        }
    }
}

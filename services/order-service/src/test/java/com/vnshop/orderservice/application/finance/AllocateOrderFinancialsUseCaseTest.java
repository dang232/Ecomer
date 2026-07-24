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
                subOrder(11L, "seller-standard", 100L, 10L, CommissionTier.STANDARD),
                subOrder(12L, "seller-mall", 300L, 30L, CommissionTier.MALL)),
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
                new AllocateOrderFinancialsUseCase(new RecordingAllocations()).allocate(order);

        assertThat(allocations).extracting(SubOrderFinancialAllocation::subOrderId)
                .containsExactly(20L, 10L, 30L);
        assertThat(allocations).extracting(a -> a.components().platformFundedDiscountAmount())
                .containsExactly(new BigDecimal("0"), new BigDecimal("1"), new BigDecimal("0"));
    }

    @Test
    void allocatesShippingAndTaxFromPersistedSubOrderAndLineItemAmounts() {
        SubOrder first = new SubOrder(11L, "seller-a", List.of(
                item("seller-a", 100L, 7L), item("seller-a", 100L, 4L)),
                com.vnshop.orderservice.domain.FulfillmentStatus.PENDING_ACCEPTANCE, new Money(new BigDecimal("9")),
                "STANDARD", null, null, CommissionTier.STANDARD);
        SubOrder second = new SubOrder(12L, "seller-b", List.of(item("seller-b", 300L, 29L)),
                com.vnshop.orderservice.domain.FulfillmentStatus.PENDING_ACCEPTANCE, new Money(new BigDecimal("91")),
                "STANDARD", null, null, CommissionTier.STANDARD);
        Order order = order(List.of(first, second), 40L, 40L);

        List<SubOrderFinancialAllocation> allocations =
                new AllocateOrderFinancialsUseCase(new RecordingAllocations()).allocate(order);

        assertThat(allocations).extracting(a -> a.components().buyerShippingChargeAmount())
                .containsExactly(new BigDecimal("9"), new BigDecimal("91"));
        assertThat(allocations).extracting(a -> a.components().taxChargedAmount())
                .containsExactly(new BigDecimal("11"), new BigDecimal("29"));
        assertThat(allocations.stream().map(a -> a.components().buyerPaidAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo(order.finalAmount().amount());
        assertThat(allocations.stream().map(a -> a.components().platformFundedDiscountAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo(order.discount().amount());
        assertThat(allocations.stream().map(a -> a.components().buyerShippingChargeAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo(order.shippingTotal().amount());
        assertThat(allocations.stream().map(a -> a.components().taxChargedAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo(order.taxTotal().amount());
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

    private static Order order(List<SubOrder> subOrders, long discount, long tax) {
        Order order = new Order(UUID.randomUUID(), "buyer", new Address("street", null, "district", "city"),
                subOrders, "idempotency-" + UUID.randomUUID());
        order.calculateTotals();
        order.applyDiscount(new Money(BigDecimal.valueOf(discount)));
        order.applyTax(new Money(BigDecimal.valueOf(tax)));
        return order;
    }

    private static SubOrder subOrder(Long id, String sellerId, long amount, CommissionTier tier) {
        return subOrder(id, sellerId, amount, 0L, tier);
    }

    private static SubOrder subOrder(Long id, String sellerId, long amount, long taxAmount, CommissionTier tier) {
        return new SubOrder(id, sellerId, List.of(item(sellerId, amount, taxAmount)),
                com.vnshop.orderservice.domain.FulfillmentStatus.PENDING_ACCEPTANCE, Money.ZERO,
                "STANDARD", null, null, tier);
    }

    private static OrderItem item(String sellerId, long amount, long taxAmount) {
        return new OrderItem("product-" + sellerId + '-' + amount + '-' + taxAmount, "sku", sellerId,
                "Product", 1, new Money(BigDecimal.valueOf(amount)), null, new BigDecimal("0.10"),
                BigDecimal.valueOf(taxAmount));
    }

    private static final class RecordingAllocations implements SubOrderFinancialAllocationRepositoryPort {
        private final List<SubOrderFinancialAllocation> saved = new ArrayList<>();

        @Override
        public void saveAll(List<SubOrderFinancialAllocation> allocations) {
            saved.addAll(allocations);
        }

        @Override
        public List<SubOrderFinancialAllocation> findByOrderId(UUID orderId) {
            return saved.stream().filter(allocation -> allocation.orderId().equals(orderId)).toList();
        }
    }
}

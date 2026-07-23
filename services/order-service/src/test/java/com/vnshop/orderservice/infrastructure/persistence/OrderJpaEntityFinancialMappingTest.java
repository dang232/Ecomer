package com.vnshop.orderservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.SubOrder;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OrderJpaEntityFinancialMappingTest {

    @Test
    void roundTripsOrderTaxTotalAndItemTaxFields() {
        OrderItem item = new OrderItem("product", "sku", "seller", "Product", 1,
                new Money(new BigDecimal("100000")), null,
                new BigDecimal("0.10"), new BigDecimal("10000"));
        Order order = new Order(UUID.randomUUID(), "buyer", new Address("street", null, "district", "city"),
                List.of(new SubOrder("seller", List.of(item))), "idempotency-" + UUID.randomUUID());
        order.applyTax(new Money(new BigDecimal("10000")));

        Order restored = OrderJpaEntity.fromDomain(order).toDomain();

        assertThat(restored.taxTotal().amount()).isEqualByComparingTo("10000");
        OrderItem restoredItem = restored.subOrders().getFirst().items().getFirst();
        assertThat(restoredItem.taxRate()).isEqualByComparingTo("0.10");
        assertThat(restoredItem.taxAmount()).isEqualByComparingTo("10000");
    }
}

package com.vnshop.orderservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.ParcelDimensions;
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
                new ParcelDimensions(1200, 30, 20, 10),
                new BigDecimal("0.10"), new BigDecimal("10000"));
        Order order = new Order(UUID.randomUUID(), "buyer", new Address("street", null, "district", "city"),
                List.of(new SubOrder("seller", List.of(item))), "idempotency-" + UUID.randomUUID());
        order.applyTax(new Money(new BigDecimal("10000")));

        Order restored = OrderJpaEntity.fromDomain(order).toDomain();

        assertThat(restored.taxTotal().amount()).isEqualByComparingTo("10000");
        OrderItem restoredItem = restored.subOrders().getFirst().items().getFirst();
        assertThat(restoredItem.taxRate()).isEqualByComparingTo("0.10");
        assertThat(restoredItem.taxAmount()).isEqualByComparingTo("10000");
        assertThat(restoredItem.parcel()).isEqualTo(new ParcelDimensions(1200, 30, 20, 10));
    }

    @Test
    void roundTripsNullParcelMetadata() {
        OrderItem item = new OrderItem("product", "sku", "seller", "Product", 1,
                new Money(new BigDecimal("100000")), null);
        Order order = new Order(UUID.randomUUID(), "buyer", new Address("street", null, "district", "city"),
                List.of(new SubOrder("seller", List.of(item))), "idempotency-" + UUID.randomUUID());

        Order restored = OrderJpaEntity.fromDomain(order).toDomain();

        assertThat(restored.subOrders().getFirst().items().getFirst().parcel()).isNull();
    }

    @Test
    void rejectsPartialPersistedParcelMetadata() {
        OrderItemJpaEntity entity = new OrderItemJpaEntity();
        entity.setProductId("product");
        entity.setVariantSku("sku");
        entity.setSellerId("seller");
        entity.setName("Product");
        entity.setQuantity(1);
        entity.setUnitPrice(OrderJpaEntity.MoneyEmbeddable.fromDomain(new Money(new BigDecimal("100000"))));
        entity.setParcelWeightGrams(1200);

        assertThat(org.assertj.core.api.Assertions.catchThrowable(entity::toDomain))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("stored parcel metadata must be complete");
    }
}

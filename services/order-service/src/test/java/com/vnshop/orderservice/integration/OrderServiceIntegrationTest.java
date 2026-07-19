package com.vnshop.orderservice.integration;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.infrastructure.persistence.OrderJpaRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;
import java.sql.Connection;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
class OrderServiceIntegrationTest {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private OrderJpaRepository orderRepository;

    @Test
    void contextLoads() {
        // Verifies: Spring context boots, Flyway migrations run, Kafka connects
        assertThat(dataSource).isNotNull();
    }

    @Test
    void flywayMigrationsApplied() throws Exception {
        try (Connection conn = dataSource.getConnection()) {
            var meta = conn.getMetaData();
            try (var tables = meta.getTables(null, "order_svc", "orders", null);
                 var auditLog = meta.getTables(null, "order_svc", "audit_log", null);
                 var invoiceCreatedAt = meta.getColumns(null, "order_svc", "invoices", "created_at");
                 var invoiceUpdatedAt = meta.getColumns(null, "order_svc", "invoices", "updated_at")) {
                assertThat(tables.next()).isTrue();
                assertThat(auditLog.next()).isTrue();
                assertThat(invoiceCreatedAt.next()).isTrue();
                assertThat(invoiceUpdatedAt.next()).isTrue();
            }
        }
    }

    @Test
    void loadsOrderItemsWhenFindingAnOrderBySubOrderId() {
        Order saved = orderRepository.save(new Order(
                UUID.randomUUID(),
                "buyer-repository-test",
                new Address("1 Test Street", null, "District 1", "Ho Chi Minh City"),
                List.of(new SubOrder("seller-repository-test", List.of(new OrderItem(
                        "product-repository-test",
                        "SKU-REPOSITORY-TEST",
                        "seller-repository-test",
                        "Repository Test Product",
                        1,
                        new Money(new BigDecimal("100000")),
                        null
                )))),
                "repository-test-" + UUID.randomUUID()
        ));

        Long subOrderId = saved.subOrders().getFirst().id();

        assertThat(orderRepository.findBySubOrderId(subOrderId))
                .isPresent()
                .get()
                .extracting(order -> order.subOrders().getFirst().items())
                .asList()
                .hasSize(1);
    }
}

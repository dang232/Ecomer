package com.vnshop.orderservice.integration;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.finance.FinancialReversal;
import com.vnshop.orderservice.domain.port.out.FinancialReversalRepositoryPort;
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
import java.sql.SQLException;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
class OrderServiceIntegrationTest {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private OrderJpaRepository orderRepository;

    @Autowired
    private FinancialReversalRepositoryPort financialReversalRepository;

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
    void adminCursorIndexesExistAndRepresentativeQueriesUseThem() throws Exception {
        try (Connection conn = dataSource.getConnection(); Statement statement = conn.createStatement()) {
            var names = new java.util.HashSet<String>();
            try (var rows = statement.executeQuery("SELECT indexname FROM pg_indexes WHERE schemaname = 'order_svc'")) {
                while (rows.next()) names.add(rows.getString(1));
            }
            assertThat(names).contains("idx_orders_admin_cursor_status_created_id",
                    "idx_orders_admin_cursor_created_id", "idx_disputes_admin_cursor_status_created_id",
                    "idx_order_summary_admin_order_id_prefix", "idx_order_summary_admin_order_number_prefix",
                    "idx_order_summary_admin_buyer_id_prefix", "idx_order_summary_admin_seller_id_prefix",
                    "idx_disputes_admin_dispute_id_prefix", "idx_disputes_admin_return_id_prefix",
                    "idx_disputes_admin_buyer_reason_prefix", "idx_disputes_admin_seller_response_prefix");

            // Small integration fixtures may make PostgreSQL prefer a sequential scan; disable it only
            // so representative index-plan contracts remain deterministic, not as a production setting.
            statement.execute("SET enable_seqscan = off");
            assertPlanUsesIndex(statement, "EXPLAIN (ANALYZE, BUFFERS) SELECT order_id FROM order_svc.order_summary "
                    + "WHERE status = 'PENDING' AND (created_at < CURRENT_TIMESTAMP OR "
                    + "(created_at = CURRENT_TIMESTAMP AND order_id < 'ffffffff-ffff-ffff-ffff-ffffffffffff')) "
                    + "ORDER BY created_at DESC, order_id DESC LIMIT 51",
                    "idx_orders_admin_cursor_status_created_id");
            assertPlanUsesIndex(statement, "EXPLAIN (ANALYZE, BUFFERS) SELECT order_id FROM order_svc.order_summary "
                    + "WHERE lower(coalesce(order_number, '')) LIKE 'prefix%' "
                    + "ORDER BY created_at DESC, order_id DESC LIMIT 51",
                    "idx_order_summary_admin_order_number_prefix");
            assertPlanUsesIndex(statement, "EXPLAIN (ANALYZE, BUFFERS) SELECT dispute_id FROM order_svc.disputes "
                    + "WHERE status = 'OPEN' AND (created_at < CURRENT_TIMESTAMP OR "
                    + "(created_at = CURRENT_TIMESTAMP AND dispute_id < 'ffffffff-ffff-ffff-ffff-ffffffffffff')) "
                    + "ORDER BY created_at DESC, dispute_id DESC LIMIT 51",
                    "idx_disputes_admin_cursor_status_created_id");
            assertPlanUsesIndex(statement, "EXPLAIN (ANALYZE, BUFFERS) SELECT dispute_id FROM order_svc.disputes "
                    + "WHERE lower(coalesce(dispute_id::text, '')) LIKE 'prefix%' LIMIT 51",
                    "idx_disputes_admin_dispute_id_prefix");
            assertPlanUsesIndex(statement, "EXPLAIN (ANALYZE, BUFFERS) SELECT dispute_id FROM order_svc.disputes "
                    + "WHERE lower(coalesce(return_id::text, '')) LIKE 'prefix%' LIMIT 51",
                    "idx_disputes_admin_return_id_prefix");
            assertPlanUsesIndex(statement, "EXPLAIN (ANALYZE, BUFFERS) SELECT dispute_id FROM order_svc.disputes "
                    + "WHERE lower(coalesce(buyer_reason, '')) LIKE 'prefix%' LIMIT 51",
                    "idx_disputes_admin_buyer_reason_prefix");
            assertPlanUsesIndex(statement, "EXPLAIN (ANALYZE, BUFFERS) SELECT dispute_id FROM order_svc.disputes "
                    + "WHERE lower(coalesce(seller_response, '')) LIKE 'prefix%' LIMIT 51",
                    "idx_disputes_admin_seller_response_prefix");
        }
    }

    private static void assertPlanUsesIndex(Statement statement, String explain, String indexName) throws SQLException {
        String plan;
        try (var rows = statement.executeQuery(explain)) {
            StringBuilder text = new StringBuilder();
            while (rows.next()) text.append(rows.getString(1)).append('\n');
            plan = text.toString();
        }
        assertThat(plan).contains(indexName).doesNotContain("Seq Scan");
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

    @Test
    void loadsSellerQueueItemsWithoutFetchingTwoBagCollectionsTogether() {
        orderRepository.save(new Order(
                UUID.randomUUID(),
                "buyer-seller-queue-test",
                new Address("1 Test Street", null, "District 1", "Ho Chi Minh City"),
                List.of(new SubOrder("seller-queue-test", List.of(new OrderItem(
                        "product-seller-queue-test",
                        "SKU-SELLER-QUEUE-TEST",
                        "seller-queue-test",
                        "Seller Queue Product",
                        1,
                        new Money(new BigDecimal("100000")),
                        null
                )))),
                "seller-queue-test-" + UUID.randomUUID()
        ));

        assertThat(orderRepository.findBySellerIdAndFulfillmentStatusIn(
                "seller-queue-test", List.of(FulfillmentStatus.PENDING_ACCEPTANCE), "queue product"))
                .hasSize(1)
                .first()
                .extracting(order -> order.subOrders().getFirst().items())
                .asList()
                .hasSize(1);
    }

    @Test
    void rejectsUpdatesAndDeletesOfFinancialAllocations() throws Exception {
        UUID allocationId = UUID.randomUUID();
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO order_svc.sub_order_financial_allocations (
                      allocation_id, allocation_version, order_id, sub_order_id, seller_id, commission_tier,
                      frozen_commission_rate, item_gmv_amount, seller_funded_discount_amount,
                      platform_funded_discount_amount, buyer_shipping_charge_amount, seller_shipping_payable_amount,
                      tax_charged_amount, seller_tax_payable_amount, commission_base_amount,
                      platform_commission_amount, seller_payable_amount, buyer_paid_amount, currency, source, allocated_at
                    ) VALUES ('%s', 1, '%s', 999999, 'seller', 'STANDARD', 0.1000,
                      100, 0, 0, 0, 0, 0, 0, 100, 10, 90, 100, 'VND', 'NATIVE_V1', CURRENT_TIMESTAMP)
                    """.formatted(allocationId, UUID.randomUUID()));

            assertThatThrownBy(() -> statement.executeUpdate("UPDATE order_svc.sub_order_financial_allocations "
                    + "SET seller_id = 'changed' WHERE allocation_id = '" + allocationId + "'"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("sub_order_financial_allocations are immutable");
            assertThatThrownBy(() -> statement.executeUpdate("DELETE FROM order_svc.sub_order_financial_allocations "
                    + "WHERE allocation_id = '" + allocationId + "'"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("sub_order_financial_allocations are immutable");
        }
    }

    @Test
    void reservesRefundAndChargebackAgainstOneAllocationWithoutExceedingItsBuyerAmount() throws Exception {
        UUID allocationId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO order_svc.sub_order_financial_allocations (
                      allocation_id, allocation_version, order_id, sub_order_id, seller_id, commission_tier,
                      frozen_commission_rate, item_gmv_amount, seller_funded_discount_amount,
                      platform_funded_discount_amount, buyer_shipping_charge_amount, seller_shipping_payable_amount,
                      tax_charged_amount, seller_tax_payable_amount, commission_base_amount,
                      platform_commission_amount, seller_payable_amount, buyer_paid_amount, currency, source, allocated_at
                    ) VALUES ('%s', 1, '%s', 888888, 'seller', 'STANDARD', 0.1000,
                      100, 0, 0, 0, 0, 0, 0, 100, 10, 90, 100, 'VND', 'NATIVE_V1', CURRENT_TIMESTAMP)
                    """.formatted(allocationId, orderId));
        }

        UUID refundId = UUID.randomUUID();
        financialReversalRepository.reserve(new FinancialReversal(
                refundId, allocationId, orderId, FinancialReversal.ReversalType.REFUND,
                FinancialReversal.ReversalStatus.FINALIZED, new BigDecimal("60"), "VND",
                java.time.Instant.now(), java.time.Instant.now()), new BigDecimal("100"));

        assertThat(financialReversalRepository.remainingBuyerAmount(allocationId, new BigDecimal("100")))
                .isEqualByComparingTo("40");
        assertThatThrownBy(() -> financialReversalRepository.reserve(new FinancialReversal(
                UUID.randomUUID(), allocationId, orderId, FinancialReversal.ReversalType.CHARGEBACK,
                FinancialReversal.ReversalStatus.OPEN, new BigDecimal("50"), "VND",
                java.time.Instant.now(), java.time.Instant.now()), new BigDecimal("100")))
                .isInstanceOf(org.springframework.dao.InvalidDataAccessApiUsageException.class)
                .hasMessageContaining("exceeds remaining allocation");
    }
}

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
import com.vnshop.orderservice.infrastructure.persistence.OrderSummaryQueryPortAdapter;
import com.vnshop.orderservice.infrastructure.persistence.DisputeJpaSpringDataRepository;
import com.vnshop.orderservice.domain.Dispute;
import com.vnshop.orderservice.domain.DisputeStatus;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.transaction.annotation.Transactional;

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

    @AfterEach
    void clearCapturedSql() {
        CursorSqlCapture.clear();
    }

    @Autowired
    private DataSource dataSource;

    @Autowired
    private OrderJpaRepository orderRepository;

    @Autowired
    private FinancialReversalRepositoryPort financialReversalRepository;

    @Autowired
    private OrderSummaryQueryPortAdapter orderSummaryQueryPortAdapter;

    @Autowired
    private DisputeJpaSpringDataRepository disputeJpaSpringDataRepository;

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
            var definitions = new java.util.HashMap<String, String>();
            try (var rows = statement.executeQuery("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'order_svc'")) {
                while (rows.next()) {
                    names.add(rows.getString(1));
                    definitions.put(rows.getString(1), rows.getString(2));
                }
            }
            assertThat(names).contains("idx_orders_admin_cursor_status_created_id",
                    "idx_orders_admin_cursor_created_id", "idx_disputes_admin_cursor_status_created_id",
                    "idx_order_summary_admin_order_id_prefix", "idx_order_summary_admin_order_number_prefix",
                    "idx_order_summary_admin_buyer_id_prefix", "idx_order_summary_admin_seller_id_prefix",
                    "idx_disputes_admin_dispute_id_prefix", "idx_disputes_admin_return_id_prefix",
                    "idx_disputes_admin_buyer_reason_prefix", "idx_disputes_admin_seller_response_prefix");

            String defaultOrderPlan = explainPlan(statement, "EXPLAIN (ANALYZE, BUFFERS) SELECT order_id FROM order_svc.order_summary "
                    + "WHERE status = 'PENDING' AND (created_at < CURRENT_TIMESTAMP OR "
                    + "(created_at = CURRENT_TIMESTAMP AND order_id < 'ffffffff-ffff-ffff-ffff-ffffffffffff')) "
                    + "ORDER BY created_at DESC, order_id DESC LIMIT 51");
            String defaultDisputePlan = explainPlan(statement, "EXPLAIN (ANALYZE, BUFFERS) SELECT dispute_id FROM order_svc.disputes "
                    + "WHERE status = 'OPEN' AND (created_at < CURRENT_TIMESTAMP OR "
                    + "(created_at = CURRENT_TIMESTAMP AND dispute_id < 'ffffffff-ffff-ffff-ffff-ffffffffffff')) "
                    + "ORDER BY created_at DESC, dispute_id DESC LIMIT 51");
            // The default plans are captured as production-shaped evidence, but tiny fixtures can legitimately choose Seq Scan.
            assertThat(defaultOrderPlan).contains("Limit");
            assertThat(defaultDisputePlan).contains("Limit");

            // Disable sequential scans only to make the index-plan contract deterministic; this is not a production setting.
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
            assertThat(definitions.get("idx_disputes_admin_dispute_id_prefix")).contains("dispute_id)::character varying");
            assertThat(definitions.get("idx_disputes_admin_return_id_prefix")).contains("return_id)::character varying");
            assertThat(definitions.get("idx_disputes_admin_buyer_reason_prefix")).contains("buyer_reason");
            assertThat(definitions.get("idx_disputes_admin_seller_response_prefix")).contains("seller_response");
        }
    }

    @Test
    @Transactional
    void productionCursorQueriesEmitIndexedPredicatesAndOrdering() throws Exception {
        CursorSqlCapture.clear();
        Instant anchor = Instant.parse("2026-08-08T00:00:00Z");
        orderSummaryQueryPortAdapter.findAllCursor("phone", "PENDING", anchor, "order-0002", 51);
        disputeJpaSpringDataRepository.findCursorFirst(DisputeStatus.OPEN, "wrong", "wrong%",
                org.springframework.data.domain.PageRequest.of(0, 51));
        disputeJpaSpringDataRepository.findCursorAfter(DisputeStatus.OPEN, "wrong", "wrong%", anchor,
                UUID.fromString("00000000-0000-0000-0000-000000000002"),
                org.springframework.data.domain.PageRequest.of(8, 51));

        String sql = String.join("\n", CursorSqlCapture.statements()).toLowerCase();
        assertThat(sql).contains("order_id<?", "order by ospje1_0.created_at desc,ospje1_0.order_id desc", "fetch first ? rows only")
                .contains("created_at<?").contains("status=?")
                .contains("dispute_id<?", "order by dje1_0.created_at desc,dje1_0.dispute_id desc")
                .contains("lower(coalesce(cast(").contains("dispute_id as varchar),''))");
    }

    private static void assertPlanUsesIndex(Statement statement, String explain, String indexName) throws SQLException {
        String plan = explainPlan(statement, explain);
        assertThat(plan).contains(indexName).doesNotContain("Seq Scan");
    }

    private static String explainPlan(Statement statement, String explain) throws SQLException {
        try (var rows = statement.executeQuery(explain)) {
            StringBuilder text = new StringBuilder();
            while (rows.next()) text.append(rows.getString(1)).append('\n');
            return text.toString();
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

package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.orderservice.domain.Dispute;
import com.vnshop.orderservice.domain.DisputeStatus;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.ReturnStatus;
import com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort;
import com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import com.vnshop.orderservice.domain.port.out.UserDirectoryPort;
import com.vnshop.orderservice.domain.projection.OrderSummaryProjection;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ListOpenDisputesUseCaseTest {
    @Test
    void openDisputesExposeOrderAndDirectoryContext() {
        UUID returnId = UUID.randomUUID();
        Dispute dispute = new Dispute(UUID.randomUUID(), returnId.toString(), "wrong size", "seller response");
        Return orderReturn = new Return(returnId, "order-1", 12L, "buyer-1", "wrong size",
                ReturnStatus.REQUESTED, Instant.parse("2026-07-22T00:00:00Z"), null);
        OrderSummaryProjection order = new OrderSummaryProjection(
                "order-1", "ORD-1001", "buyer-1", "seller-1", "DISPUTED",
                BigDecimal.valueOf(100_000), 1, Instant.now(), Instant.now());
        DisputeRepositoryPort disputes = mock(DisputeRepositoryPort.class);
        ReturnRepositoryPort returns = mock(ReturnRepositoryPort.class);
        OrderSummaryQueryPort orders = mock(OrderSummaryQueryPort.class);
        UserDirectoryPort directory = (buyerIds, sellerIds) -> new UserDirectoryPort.DirectorySnapshot(
                Map.of("buyer-1", "Alice Buyer"), Map.of("seller-1", "Alice Shop"));
        when(disputes.findByStatus(DisputeStatus.OPEN.name(), "order")).thenReturn(List.of(dispute));
        when(returns.findById(returnId)).thenReturn(Optional.of(orderReturn));
        when(orders.findByOrderId("order-1")).thenReturn(Optional.of(order));

        EnrichedDispute result = new ListOpenDisputesUseCase(disputes, returns, orders, directory)
                .listOpenEnriched("order")
                .getFirst();

        assertThat(result.orderNumber()).isEqualTo("ORD-1001");
        assertThat(result.buyerName()).isEqualTo("Alice Buyer");
        assertThat(result.sellerName()).isEqualTo("Alice Shop");
    }
}

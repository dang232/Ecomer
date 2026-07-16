package com.vnshop.orderservice.infrastructure.event.projection;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.port.out.ProjectionPort;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class OrderProjectionListenerTest {

    @Test
    void projectsFulfillmentStatusAndSumsLegacyLineItemQuantities() {
        ProjectionPort projectionPort = mock(ProjectionPort.class);
        OrderProjectionListener listener = new OrderProjectionListener(
                projectionPort,
                new ObjectMapper()
        );
        String event = """
                {
                  "eventType": "ORDER_UPDATED",
                  "orderId": "00000000-0000-0000-0000-000000000001",
                  "buyerId": "buyer-1",
                  "paymentStatus": "COMPLETED",
                  "fulfillmentStatus": "CONFIRMED",
                  "sellerTotals": [
                    {"sellerId": "seller-1", "amount": 100000},
                    {"sellerId": "seller-2", "amount": 50000}
                  ],
                  "items": [
                    {"productId": "product-1", "sellerId": "seller-1", "quantity": 2},
                    {"productId": "product-2", "sellerId": "seller-2", "quantity": 1}
                  ]
                }
                """;

        listener.onOrderEvent(event);

        verify(projectionPort).upsertOrderSummary(
                "00000000-0000-0000-0000-000000000001",
                "CONFIRMED",
                "buyer-1",
                "seller-1",
                new BigDecimal("150000"),
                3
        );
    }
}

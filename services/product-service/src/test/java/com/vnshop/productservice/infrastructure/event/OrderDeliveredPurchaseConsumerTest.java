package com.vnshop.productservice.infrastructure.event;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.productservice.domain.review.port.out.PurchaseVerificationPort;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class OrderDeliveredPurchaseConsumerTest {
    private final PurchaseVerificationPort purchaseVerification = mock(PurchaseVerificationPort.class);
    private final OrderDeliveredPurchaseConsumer consumer = new OrderDeliveredPurchaseConsumer(
            new ObjectMapper(), purchaseVerification);

    @Test
    void recordsOnlyItemsFromTheDeliveredSubOrderEvent() {
        ObjectMapper mapper = new ObjectMapper();
        String payload = write(mapper, Map.of(
                "eventType", "ORDER_DELIVERED",
                "orderId", "order-1",
                "buyerId", "buyer-1",
                "items", List.of(
                        Map.of("productId", "product-1", "sellerId", "seller-1", "quantity", 2),
                        Map.of("productId", "product-2", "sellerId", "seller-1", "quantity", 1))));
        ObjectNode envelope = mapper.createObjectNode()
                .put("eventType", "ORDER_DELIVERED")
                .put("aggregateId", "order-1")
                .put("payload", payload);

        consumer.consume(write(mapper, envelope));

        verify(purchaseVerification).recordDeliveredPurchase(eq("order-1"), eq("buyer-1"), eq("product-1"), any());
        verify(purchaseVerification).recordDeliveredPurchase(eq("order-1"), eq("buyer-1"), eq("product-2"), any());
    }

    @Test
    void ignoresEventsThatAreNotOrderDelivered() {
        consumer.consume("""
                {"eventType":"ORDER_CREATED","aggregateId":"order-1","payload":"{}"}
                """);

        verify(purchaseVerification, never()).recordDeliveredPurchase(any(), any(), any(), any());
    }

    private static String write(ObjectMapper mapper, Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }
}

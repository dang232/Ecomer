package com.vnshop.orderservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventJpaEntity;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class OrderEventPublisherAdapterTest {

    @Test
    void publishesCanonicalFulfillmentStatusAndItemCount() throws Exception {
        OutboxEventRepository repository = mock(OutboxEventRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();
        OrderEventPublisherAdapter publisher = new OrderEventPublisherAdapter(repository, objectMapper);
        OrderItem item = new OrderItem(
                "product-1",
                "BLACK-128",
                "seller-1",
                "Headphones",
                2,
                new Money(new BigDecimal("120000")),
                null
        );
        SubOrder subOrder = new SubOrder(
                7L,
                "seller-1",
                List.of(item),
                FulfillmentStatus.PACKED,
                new Money(new BigDecimal("15000")),
                "STANDARD",
                "GHN",
                "TRACK-1"
        );
        Order order = new Order(
                UUID.fromString("00000000-0000-0000-0000-000000000001"),
                "VNS-20260716-0001",
                "buyer-1",
                new Address("12 Nguyen Hue", "Ben Nghe", "District 1", "Ho Chi Minh City"),
                List.of(subOrder),
                new Money(new BigDecimal("240000")),
                new Money(new BigDecimal("15000")),
                Money.ZERO,
                "VIETQR",
                PaymentStatus.COMPLETED,
                "checkout-key"
        );

        publisher.publishOrderUpdated(order);

        ArgumentCaptor<OutboxEventJpaEntity> captor = ArgumentCaptor.forClass(OutboxEventJpaEntity.class);
        verify(repository).save(captor.capture());
        JsonNode payload = objectMapper.readTree(captor.getValue().getPayload());
        assertThat(payload.path("fulfillmentStatus").asText()).isEqualTo("CONFIRMED");
        assertThat(payload.path("itemCount").asInt()).isEqualTo(2);
        assertThat(payload.path("paymentStatus").asText()).isEqualTo("COMPLETED");
    }
}

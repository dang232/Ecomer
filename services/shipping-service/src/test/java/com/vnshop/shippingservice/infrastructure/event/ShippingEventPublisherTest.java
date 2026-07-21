package com.vnshop.shippingservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.infrastructure.config.ShippingEventProperties;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShippingEventPublisherTest {

    @Test
    void statusUpdate_returnsKafkaFutureWithoutBlockingCaller() {
        KafkaTemplate<String, String> kafkaTemplate = mockKafkaTemplate();
        CompletableFuture<SendResult<String, String>> sendFuture = new CompletableFuture<>();
        when(kafkaTemplate.send(eq("shipping.status.updated"), eq("order-1"), anyString()))
                .thenReturn(sendFuture);
        ShippingEventPublisher publisher = new ShippingEventPublisher(kafkaTemplate, new ObjectMapper());

        CompletableFuture<Void> result = publisher.publishStatusUpdate(event());

        assertFalse(result.isDone());
        sendFuture.complete(null);
        assertTrue(result.isDone());
        verify(kafkaTemplate).send(eq("shipping.status.updated"), eq("order-1"), anyString());
    }

    @Test
    void statusUpdate_propagatesKafkaFailureToOutboxRelay() {
        KafkaTemplate<String, String> kafkaTemplate = mockKafkaTemplate();
        CompletableFuture<SendResult<String, String>> sendFuture = CompletableFuture.failedFuture(
                new IllegalStateException("broker unavailable"));
        when(kafkaTemplate.send(eq("shipping.status.updated"), eq("order-1"), anyString()))
                .thenReturn(sendFuture);
        ShippingEventPublisher publisher = new ShippingEventPublisher(kafkaTemplate, new ObjectMapper());

        assertTrue(publisher.publishStatusUpdate(event()).isCompletedExceptionally());
    }

    @Test
    void statusUpdate_usesConfiguredTopic() {
        KafkaTemplate<String, String> kafkaTemplate = mockKafkaTemplate();
        CompletableFuture<SendResult<String, String>> sendFuture = CompletableFuture.completedFuture(null);
        when(kafkaTemplate.send(eq("shipping.status.updated.custom"), eq("order-1"), anyString()))
                .thenReturn(sendFuture);
        ShippingEventPublisher publisher = new ShippingEventPublisher(
                kafkaTemplate,
                new ObjectMapper(),
                new ShippingEventProperties("shipping.cancelled.custom", "shipping.status.updated.custom"));

        publisher.publishStatusUpdate(event());

        verify(kafkaTemplate).send(eq("shipping.status.updated.custom"), eq("order-1"), anyString());
    }

    private static CarrierWebhookEvent event() {
        return new CarrierWebhookEvent(
                "GHN:GHN-1:2026-07-21T10:30:00Z",
                "order-1",
                "GHN",
                "GHN-1",
                "DELIVERED",
                "Delivered",
                "2026-07-21T10:30:00Z");
    }

    @SuppressWarnings("unchecked")
    private static KafkaTemplate<String, String> mockKafkaTemplate() {
        return mock(KafkaTemplate.class);
    }
}

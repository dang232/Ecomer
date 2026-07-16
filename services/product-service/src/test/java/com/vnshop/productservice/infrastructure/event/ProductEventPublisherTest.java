package com.vnshop.productservice.infrastructure.event;

import com.vnshop.productservice.domain.ProductEvent;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SuppressWarnings("unchecked")
class ProductEventPublisherTest {
    private final KafkaTemplate<String, ProductEvent> kafkaTemplate = mock(KafkaTemplate.class);
    private final MeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final ProductEventPublisher publisher = new ProductEventPublisher(kafkaTemplate, meterRegistry);

    @Test
    void publish_sendsEventToProductEventsTopic() {
        ProductEvent event = event();

        publisher.publish(event);

        verify(kafkaTemplate).send(eq("product-events"), eq("product-1"), eq(event));
    }

    @Test
    void publish_recordsSynchronousKafkaFailure() {
        when(kafkaTemplate.send(any(), any(), any())).thenThrow(new RuntimeException("Broker down"));

        assertThatCode(() -> publisher.publish(event())).doesNotThrowAnyException();

        assertThat(meterRegistry.counter("product.event.publish.failed").count()).isEqualTo(1.0);
    }

    @Test
    void publish_recordsAsynchronousKafkaFailure() {
        CompletableFuture<SendResult<String, ProductEvent>> failed = new CompletableFuture<>();
        failed.completeExceptionally(new RuntimeException("Broker down"));
        when(kafkaTemplate.send(any(), any(), any())).thenReturn(failed);

        publisher.publish(event());

        assertThat(meterRegistry.counter("product.event.publish.failed").count()).isEqualTo(1.0);
    }

    private static ProductEvent event() {
        return new ProductEvent("product-1", ProductEvent.EventType.UPDATED, null, Map.of("status", "ACTIVE"));
    }
}

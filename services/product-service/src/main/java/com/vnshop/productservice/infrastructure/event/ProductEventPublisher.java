package com.vnshop.productservice.infrastructure.event;

import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventPublisherPort;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;
import org.springframework.kafka.support.SendResult;

@Service
public class ProductEventPublisher implements ProductEventPublisherPort {
    private static final Logger LOGGER = LoggerFactory.getLogger(ProductEventPublisher.class);
    private static final String TOPIC = "product-events";
    private static final String ALERT_MARKER = "[PRODUCT-EVENT-PUBLISH-FAILED]";

    private final KafkaTemplate<String, ProductEvent> kafkaTemplate;
    private final Counter publishFailureCounter;

    public ProductEventPublisher(KafkaTemplate<String, ProductEvent> kafkaTemplate, MeterRegistry meterRegistry) {
        this.kafkaTemplate = kafkaTemplate;
        this.publishFailureCounter = Counter.builder("product.event.publish.failed")
                .description("Count of product events that failed to publish to Kafka")
                .register(meterRegistry);
    }

    @Override
    public CompletableFuture<SendResult<String, ProductEvent>> publish(ProductEvent event) {
        LOGGER.info("Publishing product event {} for product {}", event.eventType(), event.productId());
        try {
            CompletableFuture<SendResult<String, ProductEvent>> send =
                    kafkaTemplate.send(TOPIC, event.productId(), event);
            return send.whenComplete((result, error) -> {
                if (error != null) {
                    recordFailure(event, error);
                }
            });
        } catch (RuntimeException exception) {
            recordFailure(event, exception);
            return CompletableFuture.failedFuture(exception);
        }
    }

    private void recordFailure(ProductEvent event, Throwable error) {
        publishFailureCounter.increment();
        LOGGER.error("{} productId={} eventType={} error={}",
                ALERT_MARKER, event.productId(), event.eventType(), error.getMessage(), error);
    }
}

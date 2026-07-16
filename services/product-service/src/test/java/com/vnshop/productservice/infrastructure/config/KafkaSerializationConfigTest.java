package com.vnshop.productservice.infrastructure.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.productservice.domain.ProductEvent;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.support.serializer.JsonSerializer;

class KafkaSerializationConfigTest {

    @Test
    void productEventSerializerWritesInstantTimestamp() {
        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        JsonSerializer<ProductEvent> serializer = new JsonSerializer<>(objectMapper);
        ProductEvent event = new ProductEvent(
                "product-1",
                ProductEvent.EventType.UPDATED,
                Instant.parse("2026-07-15T00:00:00Z"),
                Map.of("status", "ACTIVE"));

        String json = new String(serializer.serialize("product-events", event));

        assertTrue(json.contains("\"timestamp\""));
    }
}

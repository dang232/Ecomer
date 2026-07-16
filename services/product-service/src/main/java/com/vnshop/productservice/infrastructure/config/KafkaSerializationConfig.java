package com.vnshop.productservice.infrastructure.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.apache.kafka.common.serialization.Serializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.support.serializer.JsonSerializer;

/**
 * Uses the application's Jackson mapper for Kafka values. Spring Kafka's
 * default serializer is independent from Spring Boot's mapper and otherwise
 * cannot encode the Instant carried by product and video events in this
 * service.
 */
@Configuration
@ConditionalOnBean(KafkaProperties.class)
public class KafkaSerializationConfig {

    @Bean
    public ProducerFactory<Object, Object> productProducerFactory(
            KafkaProperties kafkaProperties, ObjectMapper objectMapper) {
        Map<String, Object> properties = kafkaProperties.buildProducerProperties();
        JsonSerializer<Object> valueSerializer = new JsonSerializer<>(objectMapper);
        @SuppressWarnings("unchecked")
        Serializer<Object> keySerializer = (Serializer<Object>) (Serializer<?>) new StringSerializer();
        return new DefaultKafkaProducerFactory<>(properties, keySerializer, valueSerializer);
    }
}

package com.vnshop.searchservice.infrastructure.config;

import com.vnshop.searchservice.infrastructure.kafka.ProductEventConsumer;
import java.util.HashMap;
import java.util.Map;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.support.serializer.JsonDeserializer;

/**
 * Keeps the product-events wire contract explicit at the search boundary.
 * Product-service publishes JSON without Java type headers, so this consumer
 * must bind the payload to the search service's local event record.
 */
@Configuration
@ConditionalOnProperty(name = "spring.kafka.bootstrap-servers")
public class ProductEventKafkaConfig {

    @Bean
    public ConsumerFactory<String, ProductEventConsumer.ProductEvent> productEventConsumerFactory(
            KafkaProperties kafkaProperties) {
        Map<String, Object> properties = new HashMap<>(kafkaProperties.buildConsumerProperties());
        properties.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        properties.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        properties.put(JsonDeserializer.TRUSTED_PACKAGES,
                ProductEventConsumer.class.getPackageName());
        properties.put(JsonDeserializer.VALUE_DEFAULT_TYPE,
                ProductEventConsumer.ProductEvent.class.getName());
        properties.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        return new DefaultKafkaConsumerFactory<>(properties);
    }

    @Bean(name = "productEventKafkaListenerContainerFactory")
    public ConcurrentKafkaListenerContainerFactory<String, ProductEventConsumer.ProductEvent>
            productEventKafkaListenerContainerFactory(
                    ConsumerFactory<String, ProductEventConsumer.ProductEvent> productEventConsumerFactory) {
        ConcurrentKafkaListenerContainerFactory<String, ProductEventConsumer.ProductEvent> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(productEventConsumerFactory);
        return factory;
    }
}

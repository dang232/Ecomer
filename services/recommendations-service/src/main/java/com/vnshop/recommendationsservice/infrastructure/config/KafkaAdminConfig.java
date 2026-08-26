package com.vnshop.recommendationsservice.infrastructure.config;

import org.apache.kafka.clients.admin.AdminClientConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DefaultErrorHandler;

import java.util.HashMap;
import java.util.Map;

@Configuration
@ConditionalOnProperty(name = "vnshop.kafka.admin.enabled", havingValue = "true", matchIfMissing = true)
public class KafkaAdminConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaAdminConfig.class);

    @Bean
    @Primary
    public KafkaAdmin kafkaAdmin(KafkaProperties kafkaProperties) {
        Map<String, Object> configs = new HashMap<>(kafkaProperties.buildAdminProperties());
        KafkaAdmin admin = new KafkaAdmin(configs);
        admin.setFatalIfBrokerNotAvailable(true);
        return admin;
    }

    @Bean
    public CommonErrorHandler kafkaErrorHandler() {
        DefaultErrorHandler handler = new DefaultErrorHandler(
                (record, exception) -> LOGGER.error(
                        "Kafka message exhausted retries. topic={}, partition={}, offset={}, error={}",
                        record.topic(), record.partition(), record.offset(), exception.getMessage()),
                new BoundedExponentialJitterBackOff(1_000L, 2.0, 30_000L));
        return handler;
    }
}

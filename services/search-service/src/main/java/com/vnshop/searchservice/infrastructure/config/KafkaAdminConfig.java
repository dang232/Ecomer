package com.vnshop.searchservice.infrastructure.config;

import org.apache.kafka.clients.admin.AdminClientConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaAdminConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaAdminConfig.class);

    @Bean
    @Primary
    public KafkaAdmin kafkaAdmin(
            @Value("${spring.kafka.bootstrap-servers}") String bootstrapServers,
            @Value("${KAFKA_SASL_USERNAME}") String username,
            @Value("${KAFKA_SASL_PASSWORD}") String password) {
        Map<String, Object> configs = new HashMap<>();
        configs.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        configs.put("security.protocol", "SASL_PLAINTEXT");
        configs.put("sasl.mechanism", "PLAIN");
        configs.put("sasl.jaas.config",
                "org.apache.kafka.common.security.plain.PlainLoginModule required "
                + "username=\"" + username + "\" "
                + "password=\"" + password + "\";");
        KafkaAdmin admin = new KafkaAdmin(configs);
        admin.setFatalIfBrokerNotAvailable(false);
        return admin;
    }

    @Bean
    public CommonErrorHandler kafkaErrorHandler() {
        DefaultErrorHandler handler = new DefaultErrorHandler(
                (record, exception) -> LOGGER.error(
                        "Kafka message exhausted retries. topic={}, partition={}, offset={}, error={}",
                        record.topic(), record.partition(), record.offset(), exception.getMessage()),
                new FixedBackOff(1000L, 2L));
        return handler;
    }
}

package com.vnshop.sellerfinanceservice.infrastructure.config;

import org.apache.kafka.clients.admin.AdminClientConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DefaultErrorHandler;

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableConfigurationProperties(KafkaAdminProperties.class)
public class KafkaAdminConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaAdminConfig.class);

    @Bean
    @Primary
    public KafkaAdmin kafkaAdmin(
            KafkaAdminProperties properties) {
        Map<String, Object> configs = new HashMap<>();
        configs.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, properties.bootstrapServers());
        configs.put("security.protocol", properties.securityProtocol());
        configs.put("sasl.mechanism", properties.saslMechanism());
        configs.put("sasl.jaas.config",
                "org.apache.kafka.common.security.plain.PlainLoginModule required "
                + "username=\"" + properties.username() + "\" "
                + "password=\"" + properties.password() + "\";");
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
                new BoundedExponentialJitterBackOff(1_000L, 2.0, 30_000L));
        return handler;
    }
}

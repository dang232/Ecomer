package com.vnshop.paymentservice.infrastructure.config;

import org.apache.kafka.clients.admin.AdminClientConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

import java.util.HashMap;
import java.util.Map;

/**
 * Explicit KafkaAdmin bean so that topic auto-creation and any internal admin
 * client inherit SASL credentials. Without this, Spring's default AdminClient
 * doesn't pick up spring.kafka.properties.* in Spring Boot 4.x.
 */
@Configuration
@ConditionalOnProperty(name = "vnshop.kafka.admin.enabled", havingValue = "true", matchIfMissing = true)
public class KafkaAdminConfig {

    @Bean
    public KafkaAdmin kafkaAdmin(
            @Value("${spring.kafka.bootstrap-servers}") String bootstrapServers,
            @Value("${spring.kafka.properties.security.protocol}") String securityProtocol,
            @Value("${spring.kafka.properties.sasl.mechanism}") String saslMechanism,
            @Value("${spring.kafka.properties.sasl.jaas.config}") String jaasConfig) {
        Map<String, Object> configs = new HashMap<>();
        configs.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        configs.put("security.protocol", securityProtocol);
        configs.put("sasl.mechanism", saslMechanism);
        configs.put("sasl.jaas.config", jaasConfig);
        return new KafkaAdmin(configs);
    }

    @Bean
    public org.apache.kafka.clients.admin.NewTopic paymentWebhooksDltTopic() {
        return TopicBuilder.name("payment.webhooks.dlt")
                .partitions(6)
                .replicas(1)
                .build();
    }
}

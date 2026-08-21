package com.vnshop.inventoryservice.infrastructure.config;

import org.apache.kafka.clients.admin.AdminClientConfig;
import org.springframework.boot.kafka.autoconfigure.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaAdmin;

import java.util.HashMap;
import java.util.Map;

/**
 * Explicit KafkaAdmin bean so that topic auto-creation and any internal admin
 * client inherit SASL credentials. Without this, Spring's default AdminClient
 * doesn't pick up spring.kafka.properties.* in Spring Boot 4.x.
 */
@Configuration
public class KafkaAdminConfig {

    @Bean
    public KafkaAdmin kafkaAdmin(KafkaProperties kafkaProperties) {
        Map<String, Object> configs = new HashMap<>(kafkaProperties.buildAdminProperties());
        return new KafkaAdmin(configs);
    }

}

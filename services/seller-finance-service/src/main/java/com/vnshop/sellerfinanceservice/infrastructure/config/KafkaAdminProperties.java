package com.vnshop.sellerfinanceservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kafka.admin")
public record KafkaAdminProperties(
        String bootstrapServers,
        String username,
        String password,
        String securityProtocol,
        String saslMechanism) {

    public KafkaAdminProperties {
        required(bootstrapServers, "kafka.admin.bootstrap-servers");
        required(username, "kafka.admin.username");
        required(password, "kafka.admin.password");
        required(securityProtocol, "kafka.admin.security-protocol");
        required(saslMechanism, "kafka.admin.sasl-mechanism");
    }

    private static void required(String value, String propertyName) {
        if (value == null || value.isBlank()) throw new IllegalStateException(propertyName + " must be configured");
    }
}

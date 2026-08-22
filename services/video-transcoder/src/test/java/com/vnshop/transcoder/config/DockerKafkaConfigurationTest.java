package com.vnshop.transcoder.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class DockerKafkaConfigurationTest {

    @Test
    void dockerProfileUsesSaslPlaintextForLocalComposeBroker() throws IOException {
        try (InputStream resource = getClass().getResourceAsStream("/application.yml")) {
            assertThat(resource).isNotNull();
            String yaml = new String(resource.readAllBytes(), StandardCharsets.UTF_8);
            assertThat(yaml)
                    .contains("on-profile: local-only-docker")
                    .contains("security.protocol: ${KAFKA_SECURITY_PROTOCOL:SASL_SSL}");
        }
    }
}

package com.vnshop.transcoder.config;

import com.vnshop.transcoder.model.TranscodeJob;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.support.serializer.JsonDeserializer;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaConsumerConfig {

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    @Value("${spring.kafka.properties.security.protocol:SASL_SSL}")
    private String securityProtocol;

    @Value("${spring.kafka.properties.sasl.mechanism:PLAIN}")
    private String saslMechanism;

    @Value("${spring.kafka.properties.sasl.jaas.config:}")
    private String saslJaasConfig;

    @Value("${spring.kafka.properties.ssl.truststore.location:}")
    private String sslTruststoreLocation;

    @Value("${spring.kafka.properties.ssl.truststore.password:}")
    private String sslTruststorePassword;

    @Bean
    public ConsumerFactory<String, TranscodeJob> transcodeJobConsumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "transcoder-worker");
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 1);
        props.put(ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG, 600_000);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "com.vnshop.*");
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, TranscodeJob.class.getName());
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);

        if (!saslJaasConfig.isBlank()) {
            props.put("security.protocol", securityProtocol);
            props.put("sasl.mechanism", saslMechanism);
            props.put("sasl.jaas.config", saslJaasConfig);
        }
        if (!sslTruststoreLocation.isBlank()) {
            props.put("ssl.truststore.location", sslTruststoreLocation);
            props.put("ssl.truststore.password", sslTruststorePassword);
            props.put("ssl.endpoint.identification.algorithm", "https");
        }

        return new DefaultKafkaConsumerFactory<>(props);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, TranscodeJob> transcodeKafkaListenerContainerFactory(
            ConsumerFactory<String, TranscodeJob> transcodeJobConsumerFactory) {

        ConcurrentKafkaListenerContainerFactory<String, TranscodeJob> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(transcodeJobConsumerFactory);
        // Manual ack — we commit only after the full transcode pipeline succeeds
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL_IMMEDIATE);
        factory.setConcurrency(1);
        return factory;
    }
}

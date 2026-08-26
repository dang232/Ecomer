package com.vnshop.recommendationsservice.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.retrytopic.RetryTopicConfiguration;
import org.springframework.kafka.retrytopic.RetryTopicConfigurationBuilder;

@Configuration
public class KafkaRetryConfig {
    @Bean
    RetryTopicConfiguration orderCreatedRetryTopic(KafkaTemplate<String, Object> kafkaTemplate) {
        return RetryTopicConfigurationBuilder.newInstance()
                .customBackoff(new BoundedExponentialJitterBackOff(1_000L, 2.0, 30_000L))
                .maxAttempts(3)
                .includeTopic("order.created")
                .retryTopicSuffix(".retry")
                .dltSuffix(".DLT")
                .create(kafkaTemplate);
    }
}

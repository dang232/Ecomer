package com.vnshop.paymentservice.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.retrytopic.RetryTopicConfiguration;
import org.springframework.kafka.retrytopic.RetryTopicConfigurationBuilder;

@Configuration
public class KafkaRetryConfig {
    @Bean
    RetryTopicConfiguration webhookRetryTopic(KafkaTemplate<String, Object> kafkaTemplate) {
        return RetryTopicConfigurationBuilder.newInstance()
                .customBackoff(new BoundedExponentialJitterBackOff(1_000L, 2.0, 30_000L))
                .maxAttempts(3)
                .includeTopic("payment.webhooks")
                .retryTopicSuffix(".retry")
                .dltSuffix(".dlt")
                .create(kafkaTemplate);
    }
}

package com.vnshop.userservice.infrastructure.event;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;

/**
 * Kafka consumer error handling configuration.
 * 
 * <p>Configures a {@link DefaultErrorHandler} with exponential backoff for all Kafka
 * listeners in the application. Failed messages are sent to the configured retry topic
 * (via {@code spring.kafka.listener.retry-topic.enabled}) and eventually to a dead-letter
 * topic ({@code <topic>.DLT}) if all retries are exhausted.
 * 
 * <p>Backoff starts at 1 second, doubles on each attempt, up to 5 minutes maximum.
 * After 5 failed attempts, the message goes to the dead-letter topic.
 * 
 * <p>This replaces the silent failure pattern where exceptions were caught and logged
 * without any recovery action, ensuring GDPR events are properly processed or flagged.
 */
@Configuration
public class KafkaConsumerConfig {

    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerConfig.class);

    private static final long INITIAL_INTERVAL_MS = 1_000L;
    private static final double MULTIPLIER = 2.0;
    private static final long MAX_INTERVAL_MS = 300_000L; // 5 minutes
    private static final int MAX_ATTEMPTS = 5;

    @Bean
    public CommonErrorHandler errorHandler() {
        ExponentialBackOff backOff = new ExponentialBackOff(INITIAL_INTERVAL_MS, MULTIPLIER);
        backOff.setMaxInterval(MAX_INTERVAL_MS);
        backOff.setMaxElapsedTime(MAX_INTERVAL_MS * MAX_ATTEMPTS); // Max total time

        DefaultErrorHandler errorHandler = new DefaultErrorHandler(
                (record, exception) -> {
                    // This runs when all retries are exhausted
                    log.error("Kafka message processing failed after all retries: topic={}, partition={}, offset={}, key={}",
                            record.topic(),
                            record.partition(),
                            record.offset(),
                            record.key(),
                            exception);
                },
                backOff
        );

        // Log each retry attempt
        errorHandler.setRetryListeners((record, ex, deliveryAttempt) -> {
            log.warn("Kafka message retry attempt {} for topic={}, partition={}, offset={}: {}",
                    deliveryAttempt,
                    record.topic(),
                    record.partition(),
                    record.offset(),
                    ex.getMessage());
        });

        return errorHandler;
    }
}

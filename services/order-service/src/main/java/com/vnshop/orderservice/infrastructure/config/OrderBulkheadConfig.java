package com.vnshop.orderservice.infrastructure.config;

import io.github.resilience4j.bulkhead.Bulkhead;
import io.github.resilience4j.bulkhead.BulkheadConfig;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OrderBulkheadConfig {
    @Bean
    Bulkhead inventoryOrderBulkhead(
            @Value("${resilience4j.bulkhead.instances.inventoryOrder.max-concurrent-calls:32}") int calls,
            @Value("${resilience4j.bulkhead.instances.inventoryOrder.max-wait-duration:0ms}") Duration wait) {
        return orderBulkhead("inventory", calls, wait);
    }

    @Bean
    Bulkhead paymentOrderBulkhead(
            @Value("${resilience4j.bulkhead.instances.paymentOrder.max-concurrent-calls:32}") int calls,
            @Value("${resilience4j.bulkhead.instances.paymentOrder.max-wait-duration:0ms}") Duration wait) {
        return orderBulkhead("payment", calls, wait);
    }

    @Bean
    Bulkhead shippingOrderBulkhead(
            @Value("${resilience4j.bulkhead.instances.shippingOrder.max-concurrent-calls:32}") int calls,
            @Value("${resilience4j.bulkhead.instances.shippingOrder.max-wait-duration:0ms}") Duration wait) {
        return orderBulkhead("shipping", calls, wait);
    }

    private static Bulkhead orderBulkhead(String name, int calls, Duration wait) {
        return Bulkhead.of(name, BulkheadConfig.custom()
                .maxConcurrentCalls(calls)
                .maxWaitDuration(wait)
                .build());
    }
}

package com.vnshop.recommendationsservice.infrastructure.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.util.backoff.BackOffExecution;

class BoundedExponentialJitterBackOffTest {
    @Test
    void producesBoundedExponentialDelaysWithJitter() {
        BackOffExecution execution = new BoundedExponentialJitterBackOff(1_000L, 2.0, 30_000L).start();
        long first = execution.nextBackOff();
        long second = execution.nextBackOff();
        assertTrue(first >= 800 && first <= 1_200);
        assertTrue(second >= 1_600 && second <= 2_400);
    }
}

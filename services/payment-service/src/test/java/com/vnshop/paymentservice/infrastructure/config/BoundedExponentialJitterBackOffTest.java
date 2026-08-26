package com.vnshop.paymentservice.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.util.backoff.BackOffExecution;

class BoundedExponentialJitterBackOffTest {
    @Test
    void appliesJitterWithinBoundsAndCapsTheDelay() {
        BackOffExecution execution = new BoundedExponentialJitterBackOff(1_000L, 2.0, 30_000L).start();

        long first = execution.nextBackOff();
        long second = execution.nextBackOff();
        long third = execution.nextBackOff();
        long fourth = execution.nextBackOff();
        long fifth = execution.nextBackOff();
        long capped = execution.nextBackOff();

        assertThat(first).isBetween(800L, 1_200L);
        assertThat(second).isBetween(1_600L, 2_400L);
        assertThat(third).isBetween(3_200L, 4_800L);
        assertThat(fourth).isBetween(6_400L, 9_600L);
        assertThat(fifth).isBetween(12_800L, 19_200L);
        assertThat(capped).isBetween(24_000L, 30_000L);
        assertThat(execution.nextBackOff()).isEqualTo(BackOffExecution.STOP);
    }
}

package com.vnshop.paymentservice.infrastructure.config;

import java.util.concurrent.ThreadLocalRandom;
import org.springframework.util.backoff.BackOff;
import org.springframework.util.backoff.BackOffExecution;

/** Exponential retry policy with a bounded jitter window of plus or minus 20 percent. */
public final class BoundedExponentialJitterBackOff implements BackOff {
    private final long initialInterval;
    private final double multiplier;
    private final long maxInterval;
    public BoundedExponentialJitterBackOff(long initialInterval, double multiplier, long maxInterval) {
        if (initialInterval < 1 || multiplier < 1 || maxInterval < initialInterval) {
            throw new IllegalArgumentException("Invalid exponential backoff bounds");
        }
        this.initialInterval = initialInterval;
        this.multiplier = multiplier;
        this.maxInterval = maxInterval;
    }

    @Override
    public BackOffExecution start() {
        return new BackOffExecution() {
            private long nextDelay = initialInterval;

            @Override
            public long nextBackOff() {
                if (nextDelay > maxInterval) return STOP;
                long delay = Math.min(maxInterval,
                        Math.round(nextDelay * ThreadLocalRandom.current().nextDouble(0.8, 1.2)));
                nextDelay = nextDelay >= maxInterval
                        ? maxInterval + 1
                        : Math.min(maxInterval, Math.round(nextDelay * multiplier));
                return Math.max(1, delay);
            }
        };
    }
}

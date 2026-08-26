package com.vnshop.paymentservice.infrastructure.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import com.vnshop.paymentservice.domain.port.out.PaymentMetricsPort;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

@Component
public class PaymentMetrics implements PaymentMetricsPort {

    private final Counter paymentAttempts;
    private final Counter paymentFailures;
    private final Counter paymentSuccesses;
    private final Counter paymentRefunds;
    private final Counter paymentOrphans;
    private final Timer providerLatency;
    private final AtomicLong dltAgeSeconds = new AtomicLong();

    public PaymentMetrics(MeterRegistry registry) {
        this.paymentAttempts = Counter.builder("vnshop_payment_attempts_total")
                .description("Total payment attempts")
                .register(registry);

        this.paymentFailures = Counter.builder("vnshop_payment_failures_total")
                .description("Total payment failures")
                .register(registry);

        this.paymentSuccesses = Counter.builder("vnshop_payment_successes_total")
                .description("Total successful payments")
                .register(registry);

        this.paymentRefunds = Counter.builder("vnshop_payment_refunds_total")
                .description("Total payment refunds processed")
                .register(registry);
        this.paymentOrphans = Counter.builder("payment_orphan_total")
                .description("Payments charged by a provider before persistence failed")
                .register(registry);
        this.providerLatency = Timer.builder("provider_latency_seconds")
                .description("Payment provider operation latency")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry);
        io.micrometer.core.instrument.Gauge.builder("dlt_age_seconds", dltAgeSeconds, AtomicLong::doubleValue)
                .description("Age of the oldest unreplayed payment DLT record")
                .register(registry);
    }

    public void recordAttempt() { paymentAttempts.increment(); }
    public void recordFailure() { paymentFailures.increment(); }
    public void recordSuccess() { paymentSuccesses.increment(); }
    public void recordRefund() { paymentRefunds.increment(); }
    public void recordOrphan() { paymentOrphans.increment(); }
    public Timer.Sample startProviderTimer() { return Timer.start(); }
    public void stopProviderTimer(Timer.Sample sample) { sample.stop(providerLatency); }
    public void updateDltAge(long seconds) { dltAgeSeconds.set(Math.max(0, seconds)); }
}

package com.vnshop.orderservice.infrastructure.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import com.vnshop.orderservice.infrastructure.dlt.DurableDltRepository;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventRepository;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEvent;
import com.vnshop.orderservice.infrastructure.outbox.CompensationOutboxRepository;
import com.vnshop.orderservice.infrastructure.outbox.CompensationOutboxEvent;
import com.vnshop.orderservice.infrastructure.persistence.SagaStateSpringDataRepository;
import com.vnshop.orderservice.domain.saga.SagaStatus;
import java.time.Instant;

@Component
public class OrderMetrics {

    private final Counter ordersCreated;
    private final Counter ordersCancelled;
    private final Counter ordersFailedCreation;
    private final Timer orderCreationDuration;
    private final AtomicLong outboxOldestAgeSeconds = new AtomicLong();
    private final AtomicLong outboxDeadTotal = new AtomicLong();
    private final AtomicLong sagaCompensatingAgeSeconds = new AtomicLong();
    private final AtomicLong ordersStuckCompensating = new AtomicLong();
    private final AtomicLong dltAgeSeconds = new AtomicLong();

    private final OutboxEventRepository outboxRepository;
    private final CompensationOutboxRepository compensationRepository;
    private final SagaStateSpringDataRepository sagaRepository;
    private final DurableDltRepository dltRepository;

    public OrderMetrics(MeterRegistry registry, OutboxEventRepository outboxRepository,
                        CompensationOutboxRepository compensationRepository,
                        SagaStateSpringDataRepository sagaRepository, DurableDltRepository dltRepository) {
        this.outboxRepository = outboxRepository;
        this.compensationRepository = compensationRepository;
        this.sagaRepository = sagaRepository;
        this.dltRepository = dltRepository;
        this.ordersCreated = Counter.builder("vnshop_orders_created_total")
                .description("Total orders successfully created")
                .register(registry);

        this.ordersCancelled = Counter.builder("vnshop_orders_cancelled_total")
                .description("Total orders cancelled")
                .register(registry);

        this.ordersFailedCreation = Counter.builder("vnshop_orders_creation_failed_total")
                .description("Total order creation failures")
                .register(registry);

        this.orderCreationDuration = Timer.builder("vnshop_order_creation_duration_seconds")
                .description("Order creation latency")
                .register(registry);
        Gauge.builder("outbox_oldest_age_seconds", outboxOldestAgeSeconds, AtomicLong::doubleValue)
                .description("Age of the oldest pending order outbox event")
                .register(registry);
        Gauge.builder("outbox_dead_total", outboxDeadTotal, AtomicLong::doubleValue)
                .description("Dead order outbox events")
                .register(registry);
        Gauge.builder("saga_compensating_age_seconds", sagaCompensatingAgeSeconds, AtomicLong::doubleValue)
                .description("Age of the oldest compensating order saga")
                .register(registry);
        Gauge.builder("orders_stuck_compensating", ordersStuckCompensating, AtomicLong::doubleValue)
                .description("Orders whose saga compensation is stuck")
                .register(registry);
        Gauge.builder("dlt_age_seconds", dltAgeSeconds, AtomicLong::doubleValue)
                .description("Age of the oldest unreplayed order DLT record")
                .register(registry);
    }

    public void recordOrderCreated() { ordersCreated.increment(); }
    public void recordOrderCancelled() { ordersCancelled.increment(); }
    public void recordOrderCreationFailed() { ordersFailedCreation.increment(); }
    public void updateOutboxOldestAge(long seconds) { outboxOldestAgeSeconds.set(Math.max(0, seconds)); }
    public void updateOutboxDeadTotal(long total) { outboxDeadTotal.set(Math.max(0, total)); }
    public void updateSagaCompensatingAge(long seconds) { sagaCompensatingAgeSeconds.set(Math.max(0, seconds)); }
    public void updateOrdersStuckCompensating(long total) { ordersStuckCompensating.set(Math.max(0, total)); }
    public void updateDltAge(long seconds) { dltAgeSeconds.set(Math.max(0, seconds)); }
    @Scheduled(fixedDelayString = "${observability.metrics.poll-interval-ms:30000}")
    public void refreshBacklogMetrics() {
        Instant now = Instant.now();
        updateOutboxOldestAge(ageSeconds(outboxRepository.oldestCreatedAt(OutboxEvent.Status.PENDING), now));
        updateOutboxDeadTotal(outboxRepository.count(OutboxEvent.Status.DEAD));
        updateSagaCompensatingAge(ageSeconds(sagaRepository.findOldestUpdatedAtByCurrentStep(SagaStatus.COMPENSATING).orElse(null), now));
        updateOrdersStuckCompensating(sagaRepository.countByCurrentStep(SagaStatus.COMPENSATING));
        updateDltAge(ageSeconds(dltRepository.findOldestUnreplayedFirstSeen().orElse(null), now));
    }

    private static long ageSeconds(Instant createdAt, Instant now) {
        return createdAt == null ? 0 : Math.max(0, now.getEpochSecond() - createdAt.getEpochSecond());
    }
    public Timer.Sample startTimer() { return Timer.start(); }
    public void stopTimer(Timer.Sample sample) { sample.stop(orderCreationDuration); }
}

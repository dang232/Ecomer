package com.vnshop.shippingservice.infrastructure.persistence;

import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.model.CarrierWebhookOutboxRecord;
import com.vnshop.shippingservice.domain.port.out.CarrierWebhookOutboxPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Keeps no-DB test and stub contexts usable. Production always selects the
 * JDBC adapter because a JdbcTemplate is available with the service datasource.
 */
@Repository
@ConditionalOnMissingBean(JdbcTemplate.class)
public class InMemoryCarrierWebhookOutboxAdapter implements CarrierWebhookOutboxPort {
    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();

    @Override
    public boolean accept(CarrierWebhookEvent event) {
        String key = event.carrier() + ":" + event.eventId();
        return entries.putIfAbsent(key, new Entry(UUID.randomUUID(), event)) == null;
    }

    @Override
    public List<CarrierWebhookOutboxRecord> findPending(int batchSize) {
        Instant now = Instant.now();
        List<CarrierWebhookOutboxRecord> pending = new ArrayList<>();
        for (Entry entry : entries.values()) {
            if (pending.size() == batchSize) {
                break;
            }
            synchronized (entry) {
                if (entry.state == State.PENDING
                        && (entry.nextRetryAt == null || !entry.nextRetryAt.isAfter(now))) {
                    pending.add(new CarrierWebhookOutboxRecord(entry.id, entry.event, entry.attempts, entry.nextRetryAt));
                }
            }
        }
        return pending;
    }

    @Override
    public boolean claim(UUID id) {
        Entry entry = find(id);
        if (entry == null) {
            return false;
        }
        synchronized (entry) {
            if (entry.state != State.PENDING) {
                return false;
            }
            entry.state = State.IN_FLIGHT;
            entry.claimedAt = Instant.now();
            return true;
        }
    }

    @Override
    public int recoverStaleClaims(Instant cutoff) {
        int recovered = 0;
        for (Entry entry : entries.values()) {
            synchronized (entry) {
                if (entry.state == State.IN_FLIGHT
                        && entry.claimedAt != null
                        && entry.claimedAt.isBefore(cutoff)) {
                    entry.state = State.PENDING;
                    entry.claimedAt = null;
                    entry.nextRetryAt = Instant.now();
                    recovered++;
                }
            }
        }
        return recovered;
    }

    @Override
    public void markPublished(UUID id) {
        Entry entry = find(id);
        if (entry != null) {
            synchronized (entry) {
                entry.state = State.PUBLISHED;
                entry.claimedAt = null;
            }
        }
    }

    @Override
    public void recordFailure(UUID id, int attempts, Instant nextRetryAt, boolean dead, String error) {
        Entry entry = find(id);
        if (entry != null) {
            synchronized (entry) {
                entry.attempts = attempts;
                entry.nextRetryAt = nextRetryAt;
                entry.state = dead ? State.FAILED : State.PENDING;
                entry.claimedAt = null;
            }
        }
    }

    private Entry find(UUID id) {
        return entries.values().stream().filter(entry -> entry.id.equals(id)).findFirst().orElse(null);
    }

    private enum State { PENDING, IN_FLIGHT, PUBLISHED, FAILED }

    private static final class Entry {
        private final UUID id;
        private final CarrierWebhookEvent event;
        private State state = State.PENDING;
        private int attempts;
        private Instant nextRetryAt;
        private Instant claimedAt;

        private Entry(UUID id, CarrierWebhookEvent event) {
            this.id = id;
            this.event = event;
        }
    }
}

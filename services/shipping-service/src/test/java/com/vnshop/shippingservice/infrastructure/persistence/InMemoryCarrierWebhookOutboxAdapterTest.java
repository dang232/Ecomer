package com.vnshop.shippingservice.infrastructure.persistence;

import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.model.CarrierWebhookOutboxRecord;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class InMemoryCarrierWebhookOutboxAdapterTest {
    @Test
    void acceptsDuplicatesOnceAndRecoversStaleClaims() {
        InMemoryCarrierWebhookOutboxAdapter adapter = new InMemoryCarrierWebhookOutboxAdapter();
        CarrierWebhookEvent event = new CarrierWebhookEvent(
                "event-1", "order-1", "GHN", "tracking-1", "DELIVERED", "Delivered", null);

        assertThat(adapter.accept(event)).isTrue();
        assertThat(adapter.accept(event)).isFalse();

        CarrierWebhookOutboxRecord record = adapter.findPending(10).getFirst();
        assertThat(adapter.claim(record.id())).isTrue();
        assertThat(adapter.findPending(10)).isEmpty();

        assertThat(adapter.recoverStaleClaims(Instant.now().plusSeconds(1))).isEqualTo(1);
        assertThat(adapter.findPending(10)).singleElement().extracting(CarrierWebhookOutboxRecord::event)
                .isEqualTo(event);
    }
}

package com.vnshop.paymentservice.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;

@Entity
@Table(
        schema = "payment_svc",
        name = "payment_callback_events",
        uniqueConstraints = @UniqueConstraint(
                name = "ux_payment_callback_events_correlation_status",
                columnNames = {"provider", "payment_id", "correlation_key", "event_status"}))
public class PaymentCallbackEventJpaEntity extends BaseJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "provider", nullable = false, length = 32)
    private String provider;

    @Column(name = "payment_id", nullable = false, columnDefinition = "uuid")
    private UUID paymentId;

    @Column(name = "correlation_key", nullable = false, length = 255)
    private String correlationKey;

    @Column(name = "event_status", nullable = false, length = 32)
    private String eventStatus;

    protected PaymentCallbackEventJpaEntity() {
    }

    public static PaymentCallbackEventJpaEntity of(
            String provider, UUID paymentId, String correlationKey, String eventStatus) {
        PaymentCallbackEventJpaEntity event = new PaymentCallbackEventJpaEntity();
        event.provider = provider;
        event.paymentId = paymentId;
        event.correlationKey = correlationKey;
        event.eventStatus = eventStatus;
        return event;
    }
}

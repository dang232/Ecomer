package com.vnshop.paymentservice.infrastructure.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentCallbackEventSpringDataRepository extends JpaRepository<PaymentCallbackEventJpaEntity, Long> {
    @Modifying
    @Query(value = """
            insert into payment_svc.payment_callback_events
                (provider, payment_id, correlation_key, event_status, created_at, updated_at)
            values (:provider, :paymentId, :correlationKey, :eventStatus, current_timestamp, current_timestamp)
            on conflict (provider, payment_id, correlation_key, event_status) do nothing
            """, nativeQuery = true)
    int appendIfAbsent(
            @Param("provider") String provider,
            @Param("paymentId") UUID paymentId,
            @Param("correlationKey") String correlationKey,
            @Param("eventStatus") String eventStatus);
}
